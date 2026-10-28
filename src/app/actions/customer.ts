"use server";

import { and, eq, inArray, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { branches, creatorProfiles, menuItems, orderItems, orders, savedDrinks, signatureDrinks } from "@/db/schema";
import { FREE_DRINK_COINS, HANDLE_PATTERN, signatureSlug } from "@/lib/coin-rules";
import { spendCoins, voidCoinsForOrder } from "@/lib/coins";
import { describeSelection, priceDrink } from "@/lib/drink";
import { getDrink } from "@/lib/menu";
import { logActivity } from "@/lib/audit";
import { isOpenBranch, settleExpiredLicenses } from "@/lib/licenses";
import { getSession } from "@/lib/session";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string; signIn?: boolean };

const selectionSchema = z.record(z.string().max(60), z.number().int().min(1).max(12)).refine(
  (s) => Object.keys(s).length <= 40,
  "Too many options.",
);

const signInRequired = { ok: false, error: "Please sign in first.", signIn: true } as const;
const customersOnly = { ok: false, error: "Only customer accounts can order or save drinks." } as const;

/** The signed-in customer, or the error to return. Branch owners and the admin can't order. */
async function getCustomer() {
  const session = await getSession();
  if (!session) return { error: signInRequired };
  if (session.user.role !== "customer") return { error: customersOnly };
  return { user: session.user, actor: { userId: session.user.id, userEmail: session.user.email } };
}

export async function saveDrink(input: { slug: string; name: string; selection: unknown }): Promise<Result> {
  const customer = await getCustomer();
  if (customer.error) return customer.error;

  const parsed = z
    .object({ slug: z.string().max(80), name: z.string().trim().min(1).max(60), selection: selectionSchema })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "Give your drink a name (up to 60 characters)." };

  const drink = await getDrink(parsed.data.slug);
  if (!drink) return { ok: false, error: "That drink is no longer on the menu." };
  const price = priceDrink(drink, parsed.data.selection);
  if (!price.ok) return { ok: false, error: price.errors[0] };

  const [item] = await db.select({ id: menuItems.id }).from(menuItems).where(eq(menuItems.slug, drink.slug));
  const [saved] = await db
    .insert(savedDrinks)
    .values({
      userId: customer.user.id,
    menuItemId: item.id,
      name: parsed.data.name,
      selection: parsed.data.selection,
    })
    .returning({ id: savedDrinks.id });
  await logActivity({ ...customer.actor, action: "drink.saved", targetType: "saved_drink", targetId: saved.id });
  revalidatePath("/saved");
  return { ok: true };
}

export async function deleteSavedDrink(id: number): Promise<Result> {
  const customer = await getCustomer();
  if (customer.error) return customer.error;
  // The user ID check makes sure people can only delete their own drinks.
  await db.delete(savedDrinks).where(and(eq(savedDrinks.id, id), eq(savedDrinks.userId, customer.user.id)));
  await logActivity({ ...customer.actor, action: "drink.deleted", targetType: "saved_drink", targetId: id });
  revalidatePath("/saved");
  return { ok: true };
}

const orderSchema = z.object({
  branchId: z.number().int().positive(),
  pickupName: z.string().trim().min(1).max(40),
  note: z.string().trim().max(200),
  items: z
    .array(
      z.object({
        slug: z.string().max(80),
        selection: selectionSchema,
        quantity: z.number().int().min(1).max(10),
        // A published signature drink; its stored recipe replaces the slug and selection above.
        signature: z.string().max(80).optional(),
      }),
    )
    .min(1)
    .max(20),
  useCoins: z.boolean().optional(),
});

export async function placeOrder(input: unknown): Promise<Result<{ orderId: number }>> {
  const customer = await getCustomer();
  if (customer.error) return customer.error;

  const parsed = orderSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Check your name and order details, then try again." };
  const { branchId, pickupName, note, items, useCoins } = parsed.data;

  await settleExpiredLicenses();
  const [branch] = await db
    .select({ id: branches.id })
    .from(branches)
    .where(and(eq(branches.id, branchId), isOpenBranch));
  if (!branch) return { ok: false, error: "That branch isn't taking orders right now." };

  // Signature drinks are ordered exactly as published: the stored recipe wins.
  const signatureSlugs = [...new Set(items.flatMap((i) => (i.signature ? [i.signature] : [])))];
  const signatures = signatureSlugs.length
    ? await db
        .select({ id: signatureDrinks.id, slug: signatureDrinks.slug, name: signatureDrinks.name, selection: signatureDrinks.selection, menuSlug: menuItems.slug })
        .from(signatureDrinks)
        .innerJoin(menuItems, eq(signatureDrinks.menuItemId, menuItems.id))
        .where(and(inArray(signatureDrinks.slug, signatureSlugs), eq(signatureDrinks.status, "approved")))
    : [];

  // Recompute every price on the server; prices sent by the browser are ignored.
  const lines = [];
  for (const raw of items) {
    const signature = raw.signature ? signatures.find((s) => s.slug === raw.signature) : undefined;
    if (raw.signature && !signature) return { ok: false, error: "A signature drink in your cart is no longer available." };
    const item = signature ? { ...raw, slug: signature.menuSlug, selection: signature.selection } : raw;
    const drink = await getDrink(item.slug);
    if (!drink) return { ok: false, error: "A drink in your cart is no longer on the menu." };
    const price = priceDrink(drink, item.selection);
    if (!price.ok) return { ok: false, error: `${drink.name}: ${price.errors[0]}` };
    lines.push({ drink, item, signature, unitPriceCents: price.totalCents });
  }

  const idRows = await db
    .select({ id: menuItems.id, slug: menuItems.slug })
    .from(menuItems)
    .where(inArray(menuItems.slug, lines.map((l) => l.drink.slug)));
  const ids = new Map(idRows.map((m) => [m.slug, m.id]));

  const subtotal = lines.reduce((sum, l) => sum + l.unitPriceCents * l.item.quantity, 0);
  // Bean coins pay for one drink: the most expensive one in the order.
  const discountCents = useCoins ? Math.max(...lines.map((l) => l.unitPriceCents)) : 0;
  const coinsUsed = useCoins ? FREE_DRINK_COINS : 0;
  const [order] = await db
    .insert(orders)
    .values({ userId: customer.user.id, branchId, pickupName, note, totalCents: subtotal - discountCents, coinsUsed, discountCents })
    .returning({ id: orders.id });

  try {
    await db.insert(orderItems).values(
      lines.map(({ drink, item, signature, unitPriceCents }) => ({
        orderId: order.id,
        menuItemId: ids.get(drink.slug) ?? null,
        drinkName: signature ? signature.name : drink.name,
        summary: [...(signature ? [drink.name] : []), ...describeSelection(drink, item.selection)].join(" · "),
        selection: item.selection,
        unitPriceCents,
        quantity: item.quantity,
        signatureDrinkId: signature?.id ?? null,
      })),
    );
    if (coinsUsed && !(await spendCoins(customer.user.id, order.id, coinsUsed))) {
      await db.delete(orders).where(eq(orders.id, order.id));
      return { ok: false, error: `You need ${FREE_DRINK_COINS} spendable bean coins for a free drink.` };
    }
  } catch (err) {
    // No interactive transactions on the HTTP driver, so undo the order by hand.
    await db.delete(orders).where(eq(orders.id, order.id));
    throw err;
  }

  await logActivity({
    ...customer.actor,
    action: "order.placed",
    targetType: "order",
    targetId: order.id,
    details: { branchId, totalCents: subtotal - discountCents, items: lines.length, coinsUsed },
  });
  revalidatePath("/rewards");
  return { ok: true, orderId: order.id };
}

export async function cancelOwnOrder(id: number): Promise<Result> {
  const customer = await getCustomer();
  if (customer.error) return customer.error;
  // Customers can only cancel their own orders, and only before preparation starts.
  const updated = await db
    .update(orders)
    .set({ status: "cancelled" })
    .where(and(eq(orders.id, id), eq(orders.userId, customer.user.id), eq(orders.status, "placed")))
    .returning({ id: orders.id });
  if (updated.length === 0) return { ok: false, error: "This order can no longer be cancelled." };
  await voidCoinsForOrder(id);
  await logActivity({ ...customer.actor, action: "order.cancelled", targetType: "order", targetId: id, details: { by: "customer" } });
  revalidatePath(`/orders/${id}`);
  revalidatePath("/rewards");
  return { ok: true };
}

const publishSchema = z.object({
  savedDrinkId: z.number().int().positive(),
  name: z.string().trim().min(2).max(40),
  story: z.string().trim().max(200),
  handle: z.string().trim().regex(HANDLE_PATTERN).optional(),
  showOnLeaderboard: z.boolean(),
});

/** Sends one of the customer's saved recipes to the admin to become a public signature drink. */
export async function publishSignatureDrink(input: unknown): Promise<Result<{ slug: string }>> {
  const customer = await getCustomer();
  if (customer.error) return customer.error;
  const parsed = publishSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Give your drink a name (2-40 characters) and a creator name (3-20 letters, numbers, . or _)." };
  const { savedDrinkId, name, story, handle, showOnLeaderboard } = parsed.data;

  const [saved] = await db
    .select({ menuItemId: savedDrinks.menuItemId, selection: savedDrinks.selection, slug: menuItems.slug })
    .from(savedDrinks)
    .innerJoin(menuItems, eq(savedDrinks.menuItemId, menuItems.id))
    .where(and(eq(savedDrinks.id, savedDrinkId), eq(savedDrinks.userId, customer.user.id)));
  if (!saved) return { ok: false, error: "That saved drink wasn't found." };
  const drink = await getDrink(saved.slug);
  const price = drink ? priceDrink(drink, saved.selection) : null;
  if (!price?.ok) return { ok: false, error: "This recipe no longer works with today's menu. Customize and save it again first." };

  const [profile] = await db.select().from(creatorProfiles).where(eq(creatorProfiles.userId, customer.user.id));
  if (!profile && !handle) return { ok: false, error: "Pick a creator name to show on your drink." };
  if (handle && handle.toLowerCase() !== profile?.handle.toLowerCase()) {
    const [taken] = await db
      .select({ userId: creatorProfiles.userId })
      .from(creatorProfiles)
      .where(and(eq(creatorProfiles.handle, handle), ne(creatorProfiles.userId, customer.user.id)));
    if (taken) return { ok: false, error: "That creator name is taken. Try another." };
  }
  await db
    .insert(creatorProfiles)
    .values({ userId: customer.user.id, handle: handle ?? profile!.handle, showOnLeaderboard })
    .onConflictDoUpdate({ target: creatorProfiles.userId, set: { handle: handle ?? profile!.handle, showOnLeaderboard } });

  const [created] = await db
    .insert(signatureDrinks)
    .values({ slug: signatureSlug(name), creatorId: customer.user.id, menuItemId: saved.menuItemId, name, story, selection: saved.selection })
    .returning({ id: signatureDrinks.id, slug: signatureDrinks.slug });
  await logActivity({ ...customer.actor, action: "signature.submitted", targetType: "signature_drink", targetId: created.id, details: { name } });
  revalidatePath("/rewards");
  revalidatePath("/admin", "layout");
  return { ok: true, slug: created.slug };
}

/** Changes the public creator name and leaderboard opt-in. */
export async function updateCreatorProfile(input: unknown): Promise<Result> {
  const customer = await getCustomer();
  if (customer.error) return customer.error;
  const parsed = z.object({ handle: z.string().trim().regex(HANDLE_PATTERN), showOnLeaderboard: z.boolean() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Creator names are 3-20 letters, numbers, dots or underscores." };
  const [taken] = await db
    .select({ userId: creatorProfiles.userId })
    .from(creatorProfiles)
    .where(and(eq(creatorProfiles.handle, parsed.data.handle), ne(creatorProfiles.userId, customer.user.id)));
  if (taken) return { ok: false, error: "That creator name is taken. Try another." };
  await db
    .insert(creatorProfiles)
    .values({ userId: customer.user.id, ...parsed.data })
    .onConflictDoUpdate({ target: creatorProfiles.userId, set: parsed.data });
  await logActivity({ ...customer.actor, action: "creator.updated", targetType: "user", targetId: customer.user.id, details: parsed.data });
  revalidatePath("/rewards");
  revalidatePath("/leaderboard");
  return { ok: true };
}

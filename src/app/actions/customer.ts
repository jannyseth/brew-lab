"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { branches, menuItems, orderItems, orders, savedDrinks } from "@/db/schema";
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
    .array(z.object({ slug: z.string().max(80), selection: selectionSchema, quantity: z.number().int().min(1).max(10) }))
    .min(1)
    .max(20),
});

export async function placeOrder(input: unknown): Promise<Result<{ orderId: number }>> {
  const customer = await getCustomer();
  if (customer.error) return customer.error;

  const parsed = orderSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Check your name and order details, then try again." };
  const { branchId, pickupName, note, items } = parsed.data;

  await settleExpiredLicenses();
  const [branch] = await db
    .select({ id: branches.id })
    .from(branches)
    .where(and(eq(branches.id, branchId), isOpenBranch));
  if (!branch) return { ok: false, error: "That branch isn't taking orders right now." };

  // Recompute every price on the server; prices sent by the browser are ignored.
  const lines = [];
  for (const item of items) {
    const drink = await getDrink(item.slug);
    if (!drink) return { ok: false, error: "A drink in your cart is no longer on the menu." };
    const price = priceDrink(drink, item.selection);
    if (!price.ok) return { ok: false, error: `${drink.name}: ${price.errors[0]}` };
    lines.push({ drink, item, unitPriceCents: price.totalCents });
  }

  const idRows = await db
    .select({ id: menuItems.id, slug: menuItems.slug })
    .from(menuItems)
    .where(inArray(menuItems.slug, lines.map((l) => l.drink.slug)));
  const ids = new Map(idRows.map((m) => [m.slug, m.id]));

  const totalCents = lines.reduce((sum, l) => sum + l.unitPriceCents * l.item.quantity, 0);
  const [order] = await db
    .insert(orders)
    .values({ userId: customer.user.id, branchId, pickupName, note, totalCents })
    .returning({ id: orders.id });

  try {
    await db.insert(orderItems).values(
      lines.map(({ drink, item, unitPriceCents }) => ({
        orderId: order.id,
        menuItemId: ids.get(drink.slug) ?? null,
        drinkName: drink.name,
        summary: describeSelection(drink, item.selection).join(" · "),
        selection: item.selection,
        unitPriceCents,
        quantity: item.quantity,
      })),
    );
  } catch (err) {
    // No transactions on the HTTP driver, so undo the order by hand.
    await db.delete(orders).where(eq(orders.id, order.id));
    throw err;
  }

  await logActivity({
    ...customer.actor,
    action: "order.placed",
    targetType: "order",
    targetId: order.id,
    details: { branchId, totalCents, items: lines.length },
  });
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
  await logActivity({ ...customer.actor, action: "order.cancelled", targetType: "order", targetId: id, details: { by: "customer" } });
  revalidatePath(`/orders/${id}`);
  return { ok: true };
}

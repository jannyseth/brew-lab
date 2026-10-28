import "server-only";
import { and, desc, eq, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { creatorProfiles, menuItems, orderItems, orders, signatureDrinks } from "@/db/schema";
import { creatorTiers } from "./coins";
import { describeSelection, priceDrink } from "./drink";
import { getDrink } from "./menu";
import { localNow, localTime } from "./timezone";

/** A public (approved) signature drink with today's price, or null. */
export async function getSignatureDrink(slug: string) {
  const [row] = await db
    .select({
      id: signatureDrinks.id,
      slug: signatureDrinks.slug,
      name: signatureDrinks.name,
      story: signatureDrinks.story,
      selection: signatureDrinks.selection,
      creatorId: signatureDrinks.creatorId,
      handle: creatorProfiles.handle,
      menuSlug: menuItems.slug,
    })
    .from(signatureDrinks)
    .innerJoin(menuItems, eq(signatureDrinks.menuItemId, menuItems.id))
    .leftJoin(creatorProfiles, eq(creatorProfiles.userId, signatureDrinks.creatorId))
    .where(and(eq(signatureDrinks.slug, slug), eq(signatureDrinks.status, "approved")));
  if (!row) return null;

  const drink = await getDrink(row.menuSlug);
  if (!drink) return null;
  const price = priceDrink(drink, row.selection);
  const tier = (await creatorTiers([row.creatorId])).get(row.creatorId)!.tier;
  return {
    ...row,
    handle: row.handle ?? "creator",
    baseName: drink.name,
    photoUrl: drink.photoUrl ?? null,
    summary: describeSelection(drink, row.selection).join(" · "),
    priceCents: price.ok ? price.totalCents : null,
    tier,
  };
}

export type LeaderboardRange = "week" | "all";

/**
 * Signature drinks ranked by how many different customers ordered them.
 * Only creators who opted in are listed, and only their creator name is shown.
 * The weekly board resets every Monday, shop time.
 */
export async function leaderboard(range: LeaderboardRange, limit = 20) {
  const buyers = sql<number>`count(distinct ${orders.userId})`.mapWith(Number);
  const rows = await db
    .select({
      id: signatureDrinks.id,
      slug: signatureDrinks.slug,
      name: signatureDrinks.name,
      creatorId: signatureDrinks.creatorId,
      handle: creatorProfiles.handle,
      buyers,
      cups: sql<number>`sum(${orderItems.quantity})`.mapWith(Number),
    })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .innerJoin(signatureDrinks, eq(orderItems.signatureDrinkId, signatureDrinks.id))
    .innerJoin(creatorProfiles, eq(creatorProfiles.userId, signatureDrinks.creatorId))
    .where(
      and(
        eq(orders.status, "completed"),
        ne(orders.userId, signatureDrinks.creatorId),
        eq(signatureDrinks.status, "approved"),
        eq(creatorProfiles.showOnLeaderboard, true),
        range === "week" ? sql`date_trunc('week', ${localTime(orders.completedAt)}) = date_trunc('week', ${localNow})` : undefined,
      ),
    )
    .groupBy(signatureDrinks.id, creatorProfiles.handle)
    .orderBy(desc(buyers), desc(sql`sum(${orderItems.quantity})`))
    .limit(limit);

  const tiers = await creatorTiers([...new Set(rows.map((r) => r.creatorId))]);
  return rows.map(({ creatorId, ...r }) => ({ ...r, tier: tiers.get(creatorId)!.tier }));
}

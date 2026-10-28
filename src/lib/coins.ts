import "server-only";
import { and, count, countDistinct, eq, gt, inArray, isNull, ne, or, sql, sum } from "drizzle-orm";
import { db } from "@/db";
import { coinEntries, orderItems, orders, signatureDrinks } from "@/db/schema";
import {
  creatorCredit,
  currentTier,
  HOLD_DAYS,
  PURCHASE_COINS,
  type Tier,
} from "./coin-rules";
import { localNow, localTime } from "./timezone";

const live = isNull(coinEntries.voidedAt);
const holdUntil = () => new Date(Date.now() + HOLD_DAYS * 24 * 60 * 60 * 1000);

/** Spendable coins, and earned coins still in the 7-day hold. Spent coins count right away. */
export async function coinBalance(userId: string) {
  const [row] = await db
    .select({
      spendable: sum(sql`case when ${coinEntries.amount} < 0 or ${coinEntries.availableAt} <= now() then ${coinEntries.amount} else 0 end`),
      pending: sum(sql`case when ${coinEntries.amount} > 0 and ${coinEntries.availableAt} > now() then ${coinEntries.amount} else 0 end`),
    })
    .from(coinEntries)
    .where(and(eq(coinEntries.userId, userId), live));
  return { spendable: Number(row?.spendable ?? 0), pending: Number(row?.pending ?? 0) };
}

const sameQuarter = (offset: string) =>
  sql`date_trunc('quarter', ${localTime(orders.completedAt)}) = date_trunc('quarter', ${localNow} - ${sql.raw(`interval '${offset}'`)})`;

/**
 * Distinct customers (other than the creator) who bought each creator's
 * signature drinks this quarter and last quarter, and the tier that gives.
 */
export async function creatorTiers(creatorIds: string[]) {
  const result = new Map<string, { buyersThisQuarter: number; buyersLastQuarter: number; tier: Tier }>();
  for (const id of creatorIds) result.set(id, { buyersThisQuarter: 0, buyersLastQuarter: 0, tier: "creator" });
  if (creatorIds.length === 0) return result;

  const rows = await db
    .select({
      creatorId: signatureDrinks.creatorId,
      thisQuarter: sql<number>`count(distinct ${orders.userId}) filter (where ${sameQuarter("0 months")})`.mapWith(Number),
      lastQuarter: sql<number>`count(distinct ${orders.userId}) filter (where ${sameQuarter("3 months")})`.mapWith(Number),
    })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .innerJoin(signatureDrinks, eq(orderItems.signatureDrinkId, signatureDrinks.id))
    .where(
      and(
        inArray(signatureDrinks.creatorId, creatorIds),
        eq(orders.status, "completed"),
        ne(orders.userId, signatureDrinks.creatorId),
      ),
    )
    .groupBy(signatureDrinks.creatorId);

  for (const r of rows) {
    result.set(r.creatorId, {
      buyersThisQuarter: r.thisQuarter,
      buyersLastQuarter: r.lastQuarter,
      tier: currentTier(r.thisQuarter, r.lastQuarter),
    });
  }
  return result;
}

export async function creatorTier(creatorId: string) {
  return (await creatorTiers([creatorId])).get(creatorId)!;
}

const sameLocalPeriod = (unit: "day" | "month") =>
  sql`date_trunc(${unit}, ${localTime(coinEntries.createdAt)}) = date_trunc(${unit}, ${localNow})`;

/**
 * Pays out coins once an order is paid and completed: the buyer's purchase
 * coins, and coins for each creator whose signature drink was in it. Safe to
 * call more than once; the idempotency keys stop double payouts.
 */
export async function awardCoinsForOrder(orderId: number) {
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId));
  if (!order || order.status !== "completed" || !order.paidAt) return;

  await db
    .insert(coinEntries)
    .values({
      userId: order.userId,
      kind: "purchase",
      amount: PURCHASE_COINS,
      orderId,
      idempotencyKey: `purchase:${orderId}`,
      availableAt: holdUntil(),
      note: `Order #${orderId}`,
    })
    .onConflictDoNothing();

  // One credit per creator per order, however many of their drinks it holds.
  const drinks = await db
    .selectDistinctOn([signatureDrinks.creatorId], { creatorId: signatureDrinks.creatorId, drinkId: signatureDrinks.id, name: signatureDrinks.name })
    .from(orderItems)
    .innerJoin(signatureDrinks, eq(orderItems.signatureDrinkId, signatureDrinks.id))
    .where(and(eq(orderItems.orderId, orderId), ne(signatureDrinks.creatorId, order.userId)));

  for (const d of drinks) {
    const creatorEntries = and(eq(coinEntries.userId, d.creatorId), eq(coinEntries.kind, "creator"), live);
    const [[totals], [fromBuyer], tier] = await Promise.all([
      db
        .select({
          today: sql<number>`coalesce(sum(${coinEntries.amount}) filter (where ${sameLocalPeriod("day")}), 0)`.mapWith(Number),
          month: sql<number>`coalesce(sum(${coinEntries.amount}) filter (where ${sameLocalPeriod("month")}), 0)`.mapWith(Number),
        })
        .from(coinEntries)
        .where(creatorEntries),
      db
        .select({
          today: sql<number>`count(*) filter (where ${sameLocalPeriod("day")})`.mapWith(Number),
          month: sql<number>`count(*) filter (where ${sameLocalPeriod("month")})`.mapWith(Number),
        })
        .from(coinEntries)
        .innerJoin(orders, eq(coinEntries.orderId, orders.id))
        .where(and(creatorEntries, eq(orders.userId, order.userId), gt(coinEntries.amount, 0))),
      creatorTier(d.creatorId),
    ]);

    const amount = creatorCredit({
      tier: tier.tier,
      earnedToday: totals.today,
      earnedThisMonth: totals.month,
      creditsFromBuyerToday: fromBuyer.today,
      creditsFromBuyerThisMonth: fromBuyer.month,
    });
    if (amount <= 0) continue;

    await db
      .insert(coinEntries)
      .values({
        userId: d.creatorId,
        kind: "creator",
        amount,
        orderId,
        signatureDrinkId: d.drinkId,
        idempotencyKey: `creator:${orderId}:${d.creatorId}`,
        availableAt: holdUntil(),
        note: `Someone ordered ${d.name}`,
      })
      .onConflictDoNothing();
  }
}

/**
 * Spends coins on an order. A per-customer lock in the same transaction stops
 * two checkouts at once from spending the same coins. Returns false if the
 * balance is too low.
 */
export async function spendCoins(userId: string, orderId: number, coins: number) {
  const [, inserted] = await db.batch([
    db.execute(sql`select pg_advisory_xact_lock(hashtext(${`coins:${userId}`}))`),
    db.execute(sql`
      insert into ${coinEntries} (user_id, kind, amount, order_id, idempotency_key, note)
      select ${userId}, 'redeem', ${-coins}, ${orderId}, ${`redeem:${orderId}`}, ${`Free drink on order #${orderId}`}
      where (
        select coalesce(sum(amount), 0) from ${coinEntries}
        where user_id = ${userId} and voided_at is null and (amount < 0 or available_at <= now())
      ) >= ${coins}
      returning id`),
  ]);
  return inserted.rows.length > 0;
}

/**
 * Undoes coins tied to an order that will not go ahead: gives back coins
 * spent on it and cancels coins earned from it that are still on hold.
 */
export async function voidCoinsForOrder(orderId: number) {
  await db
    .update(coinEntries)
    .set({ voidedAt: new Date() })
    .where(
      and(
        eq(coinEntries.orderId, orderId),
        live,
        or(eq(coinEntries.kind, "redeem"), and(gt(coinEntries.amount, 0), gt(coinEntries.availableAt, sql`now()`))),
      ),
    );
}

export async function coinHistory(userId: string, limit = 30) {
  return db
    .select()
    .from(coinEntries)
    .where(eq(coinEntries.userId, userId))
    .orderBy(sql`${coinEntries.createdAt} desc`)
    .limit(limit);
}

/** Orders, distinct buyers and coins earned per signature drink, for a creator's own list. */
export async function signatureDrinkStats(drinkIds: number[]) {
  if (drinkIds.length === 0) return new Map<number, { orders: number; buyers: number; coins: number }>();
  const [sales, coins] = await Promise.all([
    db
      .select({
        drinkId: orderItems.signatureDrinkId,
        orders: count(orders.id),
        buyers: countDistinct(orders.userId),
      })
      .from(orderItems)
      .innerJoin(orders, eq(orderItems.orderId, orders.id))
      .innerJoin(signatureDrinks, eq(orderItems.signatureDrinkId, signatureDrinks.id))
      .where(and(inArray(orderItems.signatureDrinkId, drinkIds), eq(orders.status, "completed"), ne(orders.userId, signatureDrinks.creatorId)))
      .groupBy(orderItems.signatureDrinkId),
    db
      .select({ drinkId: coinEntries.signatureDrinkId, coins: sum(coinEntries.amount) })
      .from(coinEntries)
      .where(and(inArray(coinEntries.signatureDrinkId, drinkIds), eq(coinEntries.kind, "creator"), live))
      .groupBy(coinEntries.signatureDrinkId),
  ]);
  const result = new Map<number, { orders: number; buyers: number; coins: number }>();
  for (const id of drinkIds) result.set(id, { orders: 0, buyers: 0, coins: 0 });
  for (const s of sales) if (s.drinkId) Object.assign(result.get(s.drinkId)!, { orders: s.orders, buyers: s.buyers });
  for (const c of coins) if (c.drinkId) result.get(c.drinkId)!.coins = Number(c.coins ?? 0);
  return result;
}

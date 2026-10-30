import "server-only";
import { and, desc, eq, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { branches, orderItems, orders, receiptShares } from "@/db/schema";
import { localTime } from "./timezone";

// What a shared receipt link shows. Only drinks, totals, branch and dates:
// never the pickup name, the barista note or anything else personal.

/** Monday of the order's week in the shop's timezone, as YYYY-MM-DD. */
export const orderWeek = sql<string>`to_char(date_trunc('week', ${localTime(orders.createdAt)}), 'YYYY-MM-DD')`;

export type SharedReceipt =
  | {
      kind: "order";
      branch: string;
      date: Date;
      items: { name: string; quantity: number; cents: number }[];
      totalCents: number;
    }
  | {
      kind: "week";
      weekStart: string;
      orders: number;
      drinks: number;
      totalCents: number;
      favorite: string | null;
      branches: string[];
    };

export async function loadSharedReceipt(token: string): Promise<SharedReceipt | null> {
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) return null;
  const [share] = await db.select().from(receiptShares).where(eq(receiptShares.token, token));
  if (!share) return null;

  if (share.orderId) {
    const [row] = await db
      .select({ order: orders, branch: branches.name })
      .from(orders)
      .innerJoin(branches, eq(orders.branchId, branches.id))
      .where(and(eq(orders.id, share.orderId), ne(orders.status, "cancelled")));
    if (!row) return null;
    const items = await db
      .select({ name: orderItems.drinkName, quantity: orderItems.quantity, cents: orderItems.unitPriceCents })
      .from(orderItems)
      .where(eq(orderItems.orderId, share.orderId));
    return {
      kind: "order",
      branch: row.branch,
      date: row.order.createdAt,
      items: items.map((i) => ({ ...i, cents: i.cents * i.quantity })),
      totalCents: row.order.totalCents,
    };
  }

  if (!share.weekStart) return null;
  const inWeek = and(eq(orders.userId, share.userId), ne(orders.status, "cancelled"), eq(orderWeek, share.weekStart));
  const [[totals], top, places] = await Promise.all([
    db
      .select({ orders: sql<number>`count(*)::int`, total: sql<number>`coalesce(sum(${orders.totalCents}), 0)::int` })
      .from(orders)
      .where(inWeek),
    db
      .select({ name: orderItems.drinkName, cups: sql<number>`sum(${orderItems.quantity})::int` })
      .from(orderItems)
      .innerJoin(orders, eq(orderItems.orderId, orders.id))
      .where(inWeek)
      .groupBy(orderItems.drinkName)
      .orderBy(desc(sql`2`)),
    db.selectDistinct({ name: branches.name }).from(orders).innerJoin(branches, eq(orders.branchId, branches.id)).where(inWeek),
  ]);
  if (totals.orders === 0) return null;
  return {
    kind: "week",
    weekStart: share.weekStart,
    orders: totals.orders,
    drinks: top.reduce((n, t) => n + t.cups, 0),
    totalCents: totals.total,
    favorite: top[0]?.name ?? null,
    branches: places.map((p) => p.name),
  };
}

/** "Oct 27 – Nov 2" for a Monday given as YYYY-MM-DD. */
export function weekLabel(weekStart: string) {
  const start = new Date(`${weekStart}T00:00:00Z`);
  const end = new Date(start.getTime() + 6 * 86_400_000);
  const fmt = (d: Date) => d.toLocaleDateString("en-PH", { month: "short", day: "numeric", timeZone: "UTC" });
  return `${fmt(start)} – ${fmt(end)}`;
}

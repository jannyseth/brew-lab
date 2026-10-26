import "server-only";
import { and, desc, eq, inArray, isNotNull, ne, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { branches, orderItems, orders } from "@/db/schema";
import { localNow, localTime } from "./timezone";

// Sales analytics shared by the branch and admin dashboards. A sale is an
// order marked paid that wasn't cancelled, dated by when it was paid, in
// Philippine time. Pass branch IDs to limit to those branches, or "all".

export type Scope = number[] | "all";

/** Brew Lab's platform fee on each branch's paid sales. */
export const PLATFORM_FEE_RATE = 0.3;
export const feeFor = (salesCents: number) => Math.round(salesCents * PLATFORM_FEE_RATE);

const paidAt = localTime(orders.paidAt);
const today = sql`date_trunc('day', ${localNow})`;
const monthStart = sql`date_trunc('month', ${localNow})`;
const yearStart = sql`date_trunc('year', ${localNow})`;

function isSale(scope: Scope): SQL | undefined {
  const base = and(isNotNull(orders.paidAt), ne(orders.status, "cancelled"));
  if (scope === "all") return base;
  return and(base, scope.length ? inArray(orders.branchId, scope) : sql`false`);
}

export async function salesSummary(scope: Scope) {
  const [row] = await db
    .select({
      today: sql<number>`coalesce(sum(${orders.totalCents}) filter (where ${paidAt} >= ${today}), 0)::int`,
      todayOrders: sql<number>`count(*) filter (where ${paidAt} >= ${today})::int`,
      week: sql<number>`coalesce(sum(${orders.totalCents}) filter (where ${paidAt} >= ${today} - interval '6 days'), 0)::int`,
      month: sql<number>`coalesce(sum(${orders.totalCents}) filter (where ${paidAt} >= ${monthStart}), 0)::int`,
      monthOrders: sql<number>`count(*) filter (where ${paidAt} >= ${monthStart})::int`,
      year: sql<number>`coalesce(sum(${orders.totalCents}) filter (where ${paidAt} >= ${yearStart}), 0)::int`,
      allTime: sql<number>`coalesce(sum(${orders.totalCents}), 0)::bigint::float8`,
    })
    .from(orders)
    .where(isSale(scope));
  return { ...row, averageOrder: row.monthOrders ? Math.round(row.month / row.monthOrders) : 0 };
}

/** Sales per day for the last `days` days, including days with no sales. */
export async function dailySales(scope: Scope, days = 30) {
  const rows = await db.execute<{ day: string; label: string; sales: number; orders: number }>(sql`
    with sales as (
      select date_trunc('day', ${paidAt}) as day, sum(${orders.totalCents})::int as sales, count(*)::int as orders
      from ${orders}
      where ${isSale(scope)} and ${paidAt} >= ${today} - make_interval(days => ${days - 1})
      group by 1
    )
    select to_char(d, 'YYYY-MM-DD') as day, to_char(d, 'Mon FMDD') as label,
           coalesce(s.sales, 0) as sales, coalesce(s.orders, 0) as orders
    from generate_series(${today} - make_interval(days => ${days - 1}), ${today}, interval '1 day') d
    left join sales s on s.day = d
    order by d
  `);
  return rows.rows;
}

/** Sales per month for the last `months` months, including empty months. */
export async function monthlySales(scope: Scope, months = 12) {
  const rows = await db.execute<{ month: string; label: string; sales: number; orders: number }>(sql`
    with sales as (
      select date_trunc('month', ${paidAt}) as month, sum(${orders.totalCents})::int as sales, count(*)::int as orders
      from ${orders}
      where ${isSale(scope)} and ${paidAt} >= ${monthStart} - make_interval(months => ${months - 1})
      group by 1
    )
    select to_char(m, 'YYYY-MM') as month, to_char(m, 'Mon YYYY') as label,
           coalesce(s.sales, 0) as sales, coalesce(s.orders, 0) as orders
    from generate_series(${monthStart} - make_interval(months => ${months - 1}), ${monthStart}, interval '1 month') m
    left join sales s on s.month = m
    order by m
  `);
  return rows.rows;
}

/** Best-selling drinks since the start of this month (or all time). */
export async function topDrinks(scope: Scope, period: "month" | "all" = "month", limit = 6) {
  return db
    .select({
      name: orderItems.drinkName,
      cups: sql<number>`sum(${orderItems.quantity})::int`,
      sales: sql<number>`sum(${orderItems.unitPriceCents} * ${orderItems.quantity})::int`,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .where(and(isSale(scope), period === "month" ? sql`${paidAt} >= ${monthStart}` : undefined))
    .groupBy(orderItems.drinkName)
    .orderBy(desc(sql`2`))
    .limit(limit);
}

/** Orders by weekday (0 = Sunday) and hour, by when they were placed, over the last `days` days. */
export async function activityByHour(scope: Scope, days = 90) {
  const placed = localTime(orders.createdAt);
  const where =
    scope === "all"
      ? ne(orders.status, "cancelled")
      : and(ne(orders.status, "cancelled"), scope.length ? inArray(orders.branchId, scope) : sql`false`);
  return db
    .select({
      dow: sql<number>`extract(dow from ${placed})::int`,
      hour: sql<number>`extract(hour from ${placed})::int`,
      orders: sql<number>`count(*)::int`,
    })
    .from(orders)
    .where(and(where, sql`${placed} >= ${today} - make_interval(days => ${days})`))
    .groupBy(sql`1`, sql`2`);
}

/** Paid sales per branch for this month and year. */
export async function salesByBranch(scope: Scope) {
  return db
    .select({
      id: branches.id,
      name: branches.name,
      monthOrders: sql<number>`count(${orders.id}) filter (where ${paidAt} >= ${monthStart})::int`,
      month: sql<number>`coalesce(sum(${orders.totalCents}) filter (where ${paidAt} >= ${monthStart}), 0)::int`,
      year: sql<number>`coalesce(sum(${orders.totalCents}) filter (where ${paidAt} >= ${yearStart}), 0)::int`,
    })
    .from(branches)
    .leftJoin(orders, and(eq(orders.branchId, branches.id), isSale(scope)))
    .where(and(eq(branches.status, "approved"), scope === "all" ? undefined : inArray(branches.id, scope.length ? scope : [-1])))
    .groupBy(branches.id, branches.name)
    .orderBy(desc(sql`4`));
}

/** Paid sales per branch per month for the last `months` months (months with sales only). */
export async function branchMonthlySales(months = 12) {
  const rows = await db.execute<{ branch_id: number; branch_name: string; month: string; sales: number }>(sql`
    select ${orders.branchId} as branch_id, ${branches.name} as branch_name,
           to_char(date_trunc('month', ${paidAt}), 'YYYY-MM') as month, sum(${orders.totalCents})::int as sales
    from ${orders} join ${branches} on ${branches.id} = ${orders.branchId}
    where ${isSale("all")} and ${paidAt} >= ${monthStart} - make_interval(months => ${months - 1})
    group by 1, 2, 3
    order by 3 desc, 2
  `);
  return rows.rows;
}

/** The current month in Philippine time, "YYYY-MM". */
export async function currentMonth() {
  const rows = await db.execute<{ month: string }>(sql`select to_char(${localNow}, 'YYYY-MM') as month`);
  return rows.rows[0].month;
}

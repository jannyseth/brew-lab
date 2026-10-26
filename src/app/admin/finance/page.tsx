import type { Metadata } from "next";
import { and, desc, eq, isNotNull, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { branches, orderItems, orders } from "@/db/schema";
import { cardClass } from "@/components/ui";
import { formatCents } from "@/lib/drink";
import { requireRole } from "@/lib/session";
import { localNow, localTime } from "@/lib/timezone";
import { AdminNav } from "../admin-nav";

export const metadata: Metadata = { title: "Admin · Finance" };

export default async function AdminFinancePage() {
  await requireRole(["super_admin"], "/admin/finance");

  // A sale is an order marked paid that wasn't cancelled, dated by when it was paid.
  const paidAt = localTime(orders.paidAt);
  const isSale = and(isNotNull(orders.paidAt), ne(orders.status, "cancelled"));
  const today = sql`date_trunc('day', ${localNow})`;
  const monthStart = sql`date_trunc('month', ${localNow})`;
  const yearStart = sql`date_trunc('year', ${localNow})`;

  const [totals] = await db
    .select({
      today: sql<number>`coalesce(sum(${orders.totalCents}) filter (where ${paidAt} >= ${today}), 0)::int`,
      week: sql<number>`coalesce(sum(${orders.totalCents}) filter (where ${paidAt} >= ${today} - interval '6 days'), 0)::int`,
      month: sql<number>`coalesce(sum(${orders.totalCents}) filter (where ${paidAt} >= ${monthStart}), 0)::int`,
      monthOrders: sql<number>`count(*) filter (where ${paidAt} >= ${monthStart})::int`,
      year: sql<number>`coalesce(sum(${orders.totalCents}) filter (where ${paidAt} >= ${yearStart}), 0)::int`,
    })
    .from(orders)
    .where(isSale);

  const byBranch = await db
    .select({
      id: branches.id,
      name: branches.name,
      monthOrders: sql<number>`count(${orders.id}) filter (where ${paidAt} >= ${monthStart})::int`,
      month: sql<number>`coalesce(sum(${orders.totalCents}) filter (where ${paidAt} >= ${monthStart}), 0)::int`,
      year: sql<number>`coalesce(sum(${orders.totalCents}) filter (where ${paidAt} >= ${yearStart}), 0)::int`,
    })
    .from(branches)
    .leftJoin(orders, and(eq(orders.branchId, branches.id), isSale))
    .where(eq(branches.status, "approved"))
    .groupBy(branches.id, branches.name)
    .orderBy(desc(sql`4`));

  const topDrinks = await db
    .select({
      name: orderItems.drinkName,
      cups: sql<number>`sum(${orderItems.quantity})::int`,
      sales: sql<number>`sum(${orderItems.unitPriceCents} * ${orderItems.quantity})::int`,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .where(and(isSale, sql`${paidAt} >= ${monthStart}`))
    .groupBy(orderItems.drinkName)
    .orderBy(desc(sql`3`))
    .limit(5);

  const stats = [
    { label: "Today", value: totals.today },
    { label: "Last 7 days", value: totals.week },
    { label: "This month", value: totals.month },
    { label: "This year", value: totals.year },
  ];

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <AdminNav active="Finance" subtitle={`Paid sales across all branches. ${totals.monthOrders} paid orders this month. Days follow Philippine time.`} />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className={cardClass}>
            <p className="text-sm text-muted">{s.label}</p>
            <p className="mt-1 font-display text-2xl font-semibold tabular-nums">{formatCents(s.value)}</p>
          </div>
        ))}
      </div>

      <div className="mt-10 grid gap-8 md:grid-cols-[2fr_1fr]">
        <section>
          <h2 className="mb-3 text-lg font-semibold">By branch</h2>
          {byBranch.length === 0 ? (
            <p className="text-muted">No approved branches yet.</p>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-line bg-card">
              <table className="w-full text-sm">
                <thead className="text-left text-muted">
                  <tr className="border-b border-line">
                    <th className="px-4 py-2 font-medium">Branch</th>
                    <th className="px-4 py-2 text-right font-medium">Orders (month)</th>
                    <th className="px-4 py-2 text-right font-medium">Sales (month)</th>
                    <th className="px-4 py-2 text-right font-medium">Sales (year)</th>
                  </tr>
                </thead>
                <tbody className="tabular-nums">
                  {byBranch.map((b) => (
                    <tr key={b.id} className="border-b border-line last:border-0">
                      <td className="px-4 py-2">{b.name}</td>
                      <td className="px-4 py-2 text-right">{b.monthOrders}</td>
                      <td className="px-4 py-2 text-right">{formatCents(b.month)}</td>
                      <td className="px-4 py-2 text-right">{formatCents(b.year)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
        <section>
          <h2 className="mb-3 text-lg font-semibold">Top drinks this month</h2>
          {topDrinks.length === 0 ? (
            <p className="text-muted">No sales this month yet.</p>
          ) : (
            <ol className="divide-y divide-line rounded-2xl border border-line bg-card text-sm">
              {topDrinks.map((d, i) => (
                <li key={d.name} className="flex justify-between gap-4 px-4 py-2">
                  <span>
                    {i + 1}. {d.name}
                  </span>
                  <span className="tabular-nums text-muted">
                    {d.cups} · <span className="text-foreground">{formatCents(d.sales)}</span>
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </div>
  );
}

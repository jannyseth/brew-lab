import type { Metadata } from "next";
import { and, desc, eq, isNotNull, ne, sql } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { orderItems, orders } from "@/db/schema";
import { buttonSecondary, cardClass } from "@/components/ui";
import { getManagedBranch } from "@/lib/branch-access";
import { formatCents } from "@/lib/drink";
import { requireUser } from "@/lib/session";
import { localNow, localTime } from "@/lib/timezone";
import { BranchHeader } from "../branch-header";

export const metadata: Metadata = { title: "Sales" };

export default async function SalesPage({ params }: PageProps<"/branch/[branchId]/sales">) {
  const { branchId } = await params;
  const user = await requireUser(`/branch/${branchId}/sales`);
  const branch = await getManagedBranch(Number(branchId), user);
  if (!branch) notFound();

  // A sale is an order marked paid that wasn't cancelled, dated by when it was paid.
  const paidAt = localTime(orders.paidAt);
  const isSale = and(eq(orders.branchId, branch.id), isNotNull(orders.paidAt), ne(orders.status, "cancelled"));
  const today = sql`date_trunc('day', ${localNow})`;
  const monthStart = sql`date_trunc('month', ${localNow})`;

  const [totals] = await db
    .select({
      today: sql<number>`coalesce(sum(${orders.totalCents}) filter (where ${paidAt} >= ${today}), 0)::int`,
      todayOrders: sql<number>`count(*) filter (where ${paidAt} >= ${today})::int`,
      week: sql<number>`coalesce(sum(${orders.totalCents}) filter (where ${paidAt} >= ${today} - interval '6 days'), 0)::int`,
      month: sql<number>`coalesce(sum(${orders.totalCents}) filter (where ${paidAt} >= ${monthStart}), 0)::int`,
      monthOrders: sql<number>`count(*) filter (where ${paidAt} >= ${monthStart})::int`,
    })
    .from(orders)
    .where(isSale);

  const daily = await db
    .select({
      day: sql<string>`to_char(date_trunc('day', ${paidAt}), 'YYYY-MM-DD')`.as("day"),
      orders: sql<number>`count(*)::int`,
      sales: sql<number>`sum(${orders.totalCents})::int`,
    })
    .from(orders)
    .where(and(isSale, sql`${paidAt} >= ${today} - interval '29 days'`))
    .groupBy(sql`1`)
    .orderBy(desc(sql`1`));

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
    .orderBy(desc(sql`2`))
    .limit(5);

  const average = totals.monthOrders ? Math.round(totals.month / totals.monthOrders) : 0;
  const stats = [
    { label: "Today", value: formatCents(totals.today), detail: `${totals.todayOrders} orders` },
    { label: "Last 7 days", value: formatCents(totals.week), detail: "including today" },
    { label: "This month", value: formatCents(totals.month), detail: `${totals.monthOrders} orders` },
    { label: "Average order", value: formatCents(average), detail: "this month" },
  ];

  return (
    <div>
      <BranchHeader
        branch={branch}
        active="Sales"
        actions={
          <a href={`/api/exports/branch/${branch.id}/sales`} download className={buttonSecondary}>
            Download sales sheet (.xlsx)
          </a>
        }
      />
      <p className="mb-6 text-sm text-muted">
        Counts orders marked as paid. Days follow the {process.env.NEXT_PUBLIC_TIMEZONE || "UTC"} timezone.
      </p>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className={cardClass}>
            <p className="text-sm text-muted">{s.label}</p>
            <p className="mt-1 font-display text-2xl font-semibold tabular-nums">{s.value}</p>
            <p className="text-xs text-muted">{s.detail}</p>
          </div>
        ))}
      </div>

      <div className="mt-10 grid gap-8 md:grid-cols-2">
        <section>
          <h2 className="mb-3 text-lg font-semibold">Daily sales · last 30 days</h2>
          {daily.length === 0 ? (
            <p className="text-muted">No paid orders yet.</p>
          ) : (
            <table className="w-full overflow-hidden rounded-2xl border border-line bg-card text-sm">
              <thead className="text-left text-muted">
                <tr className="border-b border-line">
                  <th className="px-4 py-2 font-medium">Day</th>
                  <th className="px-4 py-2 text-right font-medium">Orders</th>
                  <th className="px-4 py-2 text-right font-medium">Sales</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {daily.map((d) => (
                  <tr key={d.day} className="border-b border-line last:border-0">
                    <td className="px-4 py-2">{d.day}</td>
                    <td className="px-4 py-2 text-right">{d.orders}</td>
                    <td className="px-4 py-2 text-right">{formatCents(d.sales)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
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
                    {d.cups} cups · <span className="text-foreground">{formatCents(d.sales)}</span>
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

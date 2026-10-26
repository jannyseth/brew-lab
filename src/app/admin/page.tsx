import type { Metadata } from "next";
import { AreaTitle } from "@/components/area-shell";
import { BarList, TrendChart } from "@/components/charts";
import { StatTiles } from "@/components/stat-tiles";
import { buttonSecondary, cardClass } from "@/components/ui";
import { dailySales, feeFor, salesByBranch, salesSummary, topDrinks } from "@/lib/analytics";
import { formatCents } from "@/lib/drink";
import { requireRole } from "@/lib/session";

export const metadata: Metadata = { title: "Admin dashboard" };

export default async function AdminDashboard() {
  await requireRole(["super_admin"], "/admin");
  const [summary, daily, byBranch, drinks] = await Promise.all([
    salesSummary("all"),
    dailySales("all", 30),
    salesByBranch("all"),
    topDrinks("all"),
  ]);

  return (
    <div>
      <AreaTitle
        title="Dashboard"
        subtitle="Paid sales across all branches, in Philippine time."
        actions={
          <a href="/api/exports/admin/sales" className={buttonSecondary} download>
            Download sales sheet
          </a>
        }
      />
      <StatTiles
        tiles={[
          { label: "Today", value: formatCents(summary.today), detail: `${summary.todayOrders} orders` },
          { label: "Last 7 days", value: formatCents(summary.week) },
          { label: "This month", value: formatCents(summary.month), detail: `${summary.monthOrders} orders` },
          { label: "Brew Lab's 30% this month", value: formatCents(feeFor(summary.month)), detail: "see Earnings", accent: true },
        ]}
      />

      <section className={`${cardClass} mt-6`}>
        <h2 className="font-semibold">Sales, last 30 days</h2>
        <TrendChart data={daily.map((d) => ({ label: d.label, value: d.sales }))} format="money" label="Paid sales per day, last 30 days" />
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className={cardClass}>
          <h2 className="mb-4 font-semibold">Sales by branch this month</h2>
          <BarList
            items={byBranch.map((b) => ({ label: b.name, value: b.month, note: `${b.monthOrders} orders` }))}
            format="money"
          />
        </section>
        <section className={cardClass}>
          <h2 className="mb-4 font-semibold">Top drinks this month</h2>
          <BarList items={drinks.map((d) => ({ label: d.name, value: d.sales, note: `${d.cups} cups` }))} format="money" />
        </section>
      </div>

      <section className={`${cardClass} mt-6`}>
        <h2 className="mb-3 font-semibold">This year by branch</h2>
        {byBranch.length === 0 ? (
          <p className="text-sm text-muted">No approved branches yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-muted">
                <tr className="border-b border-line">
                  <th className="py-2 pr-4 font-medium">Branch</th>
                  <th className="py-2 pr-4 text-right font-medium">Sales (year)</th>
                  <th className="py-2 pr-4 text-right font-medium">Brew Lab 30%</th>
                  <th className="py-2 text-right font-medium">Branch keeps</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {byBranch.map((b) => (
                  <tr key={b.id} className="border-b border-line last:border-0">
                    <td className="py-2 pr-4">{b.name}</td>
                    <td className="py-2 pr-4 text-right">{formatCents(b.year)}</td>
                    <td className="py-2 pr-4 text-right">{formatCents(feeFor(b.year))}</td>
                    <td className="py-2 text-right">{formatCents(b.year - feeFor(b.year))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

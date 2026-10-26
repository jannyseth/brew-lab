import type { Metadata } from "next";
import { db } from "@/db";
import { feeSettlements } from "@/db/schema";
import { AreaTitle } from "@/components/area-shell";
import { SplitBars } from "@/components/charts";
import { StatTiles } from "@/components/stat-tiles";
import { Badge, buttonSecondary, cardClass, formatDate } from "@/components/ui";
import { branchMonthlySales, currentMonth, feeFor, monthlySales } from "@/lib/analytics";
import { formatCents } from "@/lib/drink";
import { requireRole } from "@/lib/session";
import { FeePaidButton } from "./fee-paid-button";

export const metadata: Metadata = { title: "Earnings" };

const monthLabel = (month: string) =>
  new Intl.DateTimeFormat("en-PH", { month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${month}-01T00:00:00Z`));

export default async function EarningsPage() {
  await requireRole(["super_admin"], "/admin/earnings");
  const [rows, months, settled, thisMonth] = await Promise.all([
    branchMonthlySales(12),
    monthlySales("all", 12),
    db.select().from(feeSettlements),
    currentMonth(),
  ]);
  const settledMap = new Map(settled.map((s) => [`${s.branchId}:${s.month}`, s]));

  const lines = rows.map((r) => {
    const settlement = settledMap.get(`${r.branch_id}:${r.month}`);
    return { ...r, fee: settlement?.feeCents ?? feeFor(r.sales), settlement, inProgress: r.month === thisMonth };
  });
  const year = thisMonth.slice(0, 4);
  const earnedThisMonth = lines.filter((l) => l.month === thisMonth).reduce((s, l) => s + l.fee, 0);
  const earnedThisYear = lines.filter((l) => l.month.startsWith(year)).reduce((s, l) => s + l.fee, 0);
  const collected = settled.reduce((s, l) => s + l.feeCents, 0);
  const outstanding = lines.filter((l) => !l.settlement && !l.inProgress).reduce((s, l) => s + l.fee, 0);

  return (
    <div>
      <AreaTitle
        title="Earnings"
        subtitle="Every branch pays Brew Lab 30% of its paid sales. Mark each month as paid once you receive the branch's fee."
        actions={
          <a href="/api/exports/admin/earnings" className={buttonSecondary} download>
            Download earnings sheet
          </a>
        }
      />
      <StatTiles
        tiles={[
          { label: "Earned this month", value: formatCents(earnedThisMonth), detail: "still in progress", accent: true },
          { label: `Earned in ${year}`, value: formatCents(earnedThisYear) },
          { label: "Collected", value: formatCents(collected), detail: "fees marked paid" },
          { label: "Outstanding", value: formatCents(outstanding), detail: "finished months not yet paid" },
        ]}
      />

      <section className={`${cardClass} mt-6`}>
        <h2 className="mb-4 font-semibold">Monthly split of paid sales</h2>
        <SplitBars
          parts={["Brew Lab 30%", "Branches 70%"]}
          data={months
            .filter((m) => m.sales > 0)
            .map((m) => ({ label: m.label, a: feeFor(m.sales), b: m.sales - feeFor(m.sales) }))}
        />
      </section>

      <section className={`${cardClass} mt-6`}>
        <h2 className="mb-3 font-semibold">Fees by branch and month</h2>
        {lines.length === 0 ? (
          <p className="text-sm text-muted">No paid sales yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-muted">
                <tr className="border-b border-line">
                  <th className="py-2 pr-4 font-medium">Month</th>
                  <th className="py-2 pr-4 font-medium">Branch</th>
                  <th className="py-2 pr-4 text-right font-medium">Paid sales</th>
                  <th className="py-2 pr-4 text-right font-medium">Fee (30%)</th>
                  <th className="py-2 pr-4 font-medium">Status</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {lines.map((l) => (
                  <tr key={`${l.branch_id}:${l.month}`} className="border-b border-line last:border-0">
                    <td className="whitespace-nowrap py-2 pr-4">{monthLabel(l.month)}</td>
                    <td className="py-2 pr-4">{l.branch_name}</td>
                    <td className="py-2 pr-4 text-right">{formatCents(l.settlement?.salesCents ?? l.sales)}</td>
                    <td className="py-2 pr-4 text-right font-medium">{formatCents(l.fee)}</td>
                    <td className="py-2 pr-4">
                      {l.settlement ? (
                        <span title={`Marked paid ${formatDate(l.settlement.paidAt)}`}>
                          <Badge status="paid" />
                        </span>
                      ) : l.inProgress ? (
                        <span className="text-xs text-muted">Month in progress</span>
                      ) : (
                        <Badge status="unpaid" />
                      )}
                    </td>
                    <td className="py-2 text-right">
                      <FeePaidButton branchId={l.branch_id} month={l.month} paid={Boolean(l.settlement)} />
                    </td>
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

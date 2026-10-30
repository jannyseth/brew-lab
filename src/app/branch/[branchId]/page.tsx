import type { Metadata } from "next";
import { and, count, eq, inArray } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { orders } from "@/db/schema";
import { ActivityHeatmap, BarList, QuotaDonut, TrendChart } from "@/components/charts";
import { StatTiles } from "@/components/stat-tiles";
import { buttonSecondary, cardClass, formatDate } from "@/components/ui";
import { activityByHour, dailySales, feeFor, salesSummary, topDrinks } from "@/lib/analytics";
import { getManagedBranch } from "@/lib/branch-access";
import { formatCents } from "@/lib/drink";
import { branchSalesBetween, currentLicense, settleExpiredLicenses } from "@/lib/licenses";
import { requireUser } from "@/lib/session";
import { BranchHeader } from "./branch-header";

export const metadata: Metadata = { title: "Dashboard & sales" };

export default async function BranchDashboard({ params }: PageProps<"/branch/[branchId]">) {
  const { branchId } = await params;
  const user = await requireUser(`/branch/${branchId}`);
  const branch = await getManagedBranch(Number(branchId), user);
  if (!branch) notFound();

  await settleExpiredLicenses();
  const scope = [branch.id];
  const [summary, daily, drinks, activity, license, [open]] = await Promise.all([
    salesSummary(scope),
    dailySales(scope, 30),
    topDrinks(scope),
    activityByHour(scope, 90),
    currentLicense(branch.id),
    db
      .select({ n: count() })
      .from(orders)
      .where(and(eq(orders.branchId, branch.id), inArray(orders.status, ["placed", "preparing", "ready"]))),
  ]);
  const quotaSales = license ? await branchSalesBetween(branch.id, license.issuedAt, license.expiresAt) : 0;

  return (
    <div>
      <BranchHeader
        branch={branch}
        actions={
          <a href={`/api/exports/branch/${branch.id}/sales`} download className={buttonSecondary}>
            Download sales (.xlsx)
          </a>
        }
      />
      <StatTiles
        tiles={[
          { label: "Today", value: formatCents(summary.today), detail: `${summary.todayOrders} orders` },
          { label: "Last 7 days", value: formatCents(summary.week), detail: "including today" },
          { label: "This month", value: formatCents(summary.month), detail: `${summary.monthOrders} orders` },
          { label: "Open orders", value: String(open.n), detail: "waiting or in progress" },
        ]}
      />
      <p className="mt-3 text-sm text-muted">
        Brew Lab fee (30%) this month so far: <span className="font-medium text-foreground">{formatCents(feeFor(summary.month))}</span>
        {open.n > 0 && (
          <>
            {" · "}
            <Link href={`/branch/${branch.id}/orders`} className="font-medium text-accent hover:underline">
              Go to orders →
            </Link>
          </>
        )}
      </p>

      <section className={`${cardClass} mt-6`}>
        <h2 className="font-semibold">Sales, last 30 days</h2>
        <TrendChart data={daily.map((d) => ({ label: d.label, value: d.sales }))} format="money" label="Paid sales per day, last 30 days" />
      </section>

      <div className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
        <section className={cardClass}>
          <h2 className="mb-4 font-semibold">Top drinks this month</h2>
          <BarList items={drinks.map((d) => ({ label: d.name, value: d.sales, note: `${d.cups} cups` }))} format="money" />
        </section>
        <section className={cardClass}>
          <h2 className="mb-4 font-semibold">Renewal quota</h2>
          {license ? (
            <>
              <QuotaDonut salesCents={quotaSales} quotaCents={license.quotaCents} />
              <p className="mt-4 text-center text-xs text-muted">
                <Link href={`/licenses/${license.id}`} className="text-accent hover:underline">
                  License {license.licenseNumber}
                </Link>
                <br />
                until {formatDate(license.expiresAt)}
              </p>
            </>
          ) : (
            <p className="text-sm text-muted">No active license. Customers can&apos;t order here until the admin issues one.</p>
          )}
        </section>
      </div>

      <details className={`${cardClass} mt-6`}>
        <summary className="cursor-pointer font-semibold">Busiest times</summary>
        <p className="mb-4 mt-2 text-xs text-muted">Orders placed over the last 90 days. Plan staff around the dark squares.</p>
        <ActivityHeatmap cells={activity} />
      </details>

      <details className={`${cardClass} mt-3`}>
        <summary className="cursor-pointer font-semibold">Sales by day</summary>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-muted">
              <tr className="border-b border-line">
                <th className="py-2 font-medium">Day</th>
                <th className="py-2 text-right font-medium">Orders</th>
                <th className="py-2 text-right font-medium">Sales</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {[...daily].reverse().filter((d) => d.orders > 0).map((d) => (
                <tr key={d.day} className="border-b border-line last:border-0">
                  <td className="py-2">{d.label}</td>
                  <td className="py-2 text-right">{d.orders}</td>
                  <td className="py-2 text-right">{formatCents(d.sales)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

import type { Metadata } from "next";
import { and, count, eq, inArray } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { orders } from "@/db/schema";
import { ActivityHeatmap, BarList, QuotaDonut, TrendChart } from "@/components/charts";
import { StatTiles } from "@/components/stat-tiles";
import { cardClass, formatDate } from "@/components/ui";
import { activityByHour, dailySales, feeFor, salesSummary, topDrinks } from "@/lib/analytics";
import { getManagedBranch } from "@/lib/branch-access";
import { formatCents } from "@/lib/drink";
import { branchSalesBetween, currentLicense, settleExpiredLicenses } from "@/lib/licenses";
import { requireUser } from "@/lib/session";
import { BranchHeader } from "./branch-header";

export const metadata: Metadata = { title: "Branch dashboard" };

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
      <BranchHeader branch={branch} active="Dashboard" />
      <StatTiles
        tiles={[
          { label: "Today", value: formatCents(summary.today), detail: `${summary.todayOrders} orders` },
          { label: "This month", value: formatCents(summary.month), detail: `${summary.monthOrders} orders` },
          { label: "Open orders", value: String(open.n), detail: "waiting or in progress" },
          { label: "Brew Lab fee (30%)", value: formatCents(feeFor(summary.month)), detail: "this month so far", accent: true },
        ]}
      />
      {open.n > 0 && (
        <p className="mt-3 text-sm">
          <Link href={`/branch/${branch.id}/orders`} className="font-medium text-accent hover:underline">
            Go to the order queue →
          </Link>
        </p>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
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
                {formatDate(license.issuedAt)} – {formatDate(license.expiresAt)}
              </p>
            </>
          ) : (
            <p className="text-sm text-muted">No active license. Customers can&apos;t order here until the admin issues one.</p>
          )}
        </section>
        <section className={cardClass}>
          <h2 className="font-semibold">Sales, last 30 days</h2>
          <TrendChart data={daily.map((d) => ({ label: d.label, value: d.sales }))} format="money" label="Paid sales per day, last 30 days" />
        </section>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className={cardClass}>
          <h2 className="mb-4 font-semibold">Top drinks this month</h2>
          <BarList items={drinks.map((d) => ({ label: d.name, value: d.sales, note: `${d.cups} cups` }))} format="money" />
        </section>
        <section className={cardClass}>
          <h2 className="mb-1 font-semibold">Busiest times</h2>
          <p className="mb-4 text-xs text-muted">Orders placed over the last 90 days. Plan staff around the dark squares.</p>
          <ActivityHeatmap cells={activity} />
        </section>
      </div>
    </div>
  );
}

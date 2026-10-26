import type { Metadata } from "next";
import { and, eq } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/db";
import { branches, managerApplications } from "@/db/schema";
import { applyAsManager } from "@/app/actions/branch";
import { ActionForm } from "@/components/action-form";
import { AreaTitle } from "@/components/area-shell";
import { QuotaDonut, TrendChart } from "@/components/charts";
import { StatTiles } from "@/components/stat-tiles";
import { Badge, buttonPrimary, cardClass, formatDate, inputClass } from "@/components/ui";
import { dailySales, feeFor, salesSummary } from "@/lib/analytics";
import { formatCents } from "@/lib/drink";
import { branchSalesBetween, currentLicense, settleExpiredLicenses } from "@/lib/licenses";
import { requireRole } from "@/lib/session";

export const metadata: Metadata = { title: "Branch overview" };

export default async function BranchOverview() {
  const user = await requireRole(["branch_applicant", "branch_manager"], "/branch");
  if (user.role === "branch_applicant") return <Verification userId={user.id} defaultName={user.name} />;

  await settleExpiredLicenses();
  const approved = await db
    .select()
    .from(branches)
    .where(and(eq(branches.managerId, user.id), eq(branches.status, "approved")));
  const ids = approved.map((b) => b.id);

  if (ids.length === 0) {
    return (
      <div>
        <AreaTitle title="Overview" subtitle="Your dashboard appears here once a branch is approved." />
        <div className={cardClass}>
          <p>You don&apos;t have an approved branch yet.</p>
          <Link href="/branch/manage" className={`${buttonPrimary} mt-4 inline-block`}>
            Add or check your branches
          </Link>
        </div>
      </div>
    );
  }

  const [summary, daily, quotas] = await Promise.all([
    salesSummary(ids),
    dailySales(ids, 30),
    Promise.all(
      approved.map(async (b) => {
        const license = await currentLicense(b.id);
        const sales = license ? await branchSalesBetween(b.id, license.issuedAt, license.expiresAt) : 0;
        return { branch: b, license, sales };
      }),
    ),
  ]);

  return (
    <div>
      <AreaTitle title="Overview" subtitle={`All ${ids.length === 1 ? "of your branch" : `${ids.length} of your branches`}, paid sales in Philippine time.`} />
      <StatTiles
        tiles={[
          { label: "Today", value: formatCents(summary.today), detail: `${summary.todayOrders} orders` },
          { label: "This month", value: formatCents(summary.month), detail: `${summary.monthOrders} orders` },
          { label: "Average order", value: formatCents(summary.averageOrder), detail: "this month" },
          {
            label: "Brew Lab fee (30%)",
            value: formatCents(feeFor(summary.month)),
            detail: "on this month's sales so far",
            accent: true,
          },
        ]}
      />

      <section className="mt-6">
        <h2 className="mb-3 font-semibold">License renewal quota</h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {quotas.map(({ branch, license, sales }) => (
            <Link key={branch.id} href={`/branch/${branch.id}`} className={`${cardClass} block hover:border-accent`}>
              <div className="mb-4 flex items-start justify-between gap-2">
                <p className="font-semibold">{branch.name}</p>
                {!license && <Badge status="expired" />}
              </div>
              {license ? (
                <>
                  <QuotaDonut salesCents={sales} quotaCents={license.quotaCents} size={148} />
                  <p className="mt-3 text-center text-xs text-muted">
                    License {license.licenseNumber} · until {formatDate(license.expiresAt)}
                  </p>
                </>
              ) : (
                <p className="text-sm text-muted">No active license. Customers can&apos;t order here until the admin issues one.</p>
              )}
            </Link>
          ))}
        </div>
      </section>

      <section className={`${cardClass} mt-6`}>
        <h2 className="font-semibold">Sales, last 30 days</h2>
        <TrendChart data={daily.map((d) => ({ label: d.label, value: d.sales }))} format="money" label="Paid sales per day, last 30 days" />
      </section>
    </div>
  );
}

async function Verification({ userId, defaultName }: { userId: string; defaultName: string }) {
  const [application] = await db.select().from(managerApplications).where(eq(managerApplications.userId, userId));
  return (
    <div className="max-w-2xl">
      <AreaTitle title="Get verified" subtitle="Every branch owner is verified by the Brew Lab admin before they can open a branch." />
      {application?.status === "pending" ? (
        <div className={cardClass}>
          <Badge status="pending" />
          <p className="mt-3">Your application is waiting for review. We&apos;ll unlock your dashboard as soon as it&apos;s approved.</p>
        </div>
      ) : (
        <>
          {application?.status === "rejected" && (
            <div className={`${cardClass} mb-6`}>
              <Badge status="rejected" />
              <p className="mt-3">
                Your last application wasn&apos;t approved.
                {application.reviewNote && <> Note from the admin: “{application.reviewNote}”</>} You can apply again below.
              </p>
            </div>
          )}
          <ActionForm action={applyAsManager} submitLabel="Send for verification" className={`${cardClass} space-y-4`}>
            <label className="block text-sm font-medium">
              Owner&apos;s full legal name
              <input name="fullName" required minLength={2} maxLength={80} defaultValue={defaultName} className={inputClass} />
            </label>
            <label className="block text-sm font-medium">
              Mobile number
              <input name="phone" type="tel" required minLength={5} maxLength={30} placeholder="09XX XXX XXXX" className={inputClass} />
            </label>
            <label className="block text-sm font-medium">
              About your business <span className="font-normal text-muted">(optional)</span>
              <textarea name="message" maxLength={500} rows={3} placeholder="Business name, experience, planned locations…" className={inputClass} />
            </label>
          </ActionForm>
        </>
      )}
    </div>
  );
}

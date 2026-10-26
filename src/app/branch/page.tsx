import type { Metadata } from "next";
import { desc, eq } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/db";
import { branches, managerApplications } from "@/db/schema";
import { applyAsManager, createBranch } from "@/app/actions/branch";
import { ActionForm } from "@/components/action-form";
import { QuotaProgress } from "@/components/quota-progress";
import { Badge, cardClass, formatDate, inputClass, PageTitle } from "@/components/ui";
import { branchSalesBetween, currentLicense, settleExpiredLicenses } from "@/lib/licenses";
import { requireRole } from "@/lib/session";

export const metadata: Metadata = { title: "Branch dashboard" };

export default async function BranchDashboard() {
  const user = await requireRole(["branch_applicant", "branch_manager"], "/branch");

  if (user.role === "branch_applicant") {
    const [application] = await db.select().from(managerApplications).where(eq(managerApplications.userId, user.id));
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <PageTitle
          title="Get verified"
          subtitle="Every branch owner is verified by the Brew Lab admin before they can open a branch."
        />
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
                <input name="fullName" required minLength={2} maxLength={80} defaultValue={user.name} className={inputClass} />
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

  await settleExpiredLicenses();
  const rows = await db.select().from(branches).where(eq(branches.managerId, user.id)).orderBy(desc(branches.createdAt));
  const withLicenses = await Promise.all(
    rows.map(async (b) => {
      const license = await currentLicense(b.id);
      const sales = license ? await branchSalesBetween(b.id, license.issuedAt, license.expiresAt) : 0;
      return { ...b, license, sales };
    }),
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <PageTitle
        title="Your branches"
        subtitle="Each new branch is reviewed by the admin. Approved branches get a 1-year license that renews when the branch reaches ₱100,000 in sales that year."
      />
      {withLicenses.length > 0 && (
        <ul className="grid gap-4 sm:grid-cols-2">
          {withLicenses.map((b) => (
            <li key={b.id} className={cardClass}>
              <div className="flex items-start justify-between gap-3">
                <h2 className="font-display text-xl font-semibold">{b.name}</h2>
                <Badge status={b.status === "approved" && !b.license ? "unlicensed" : b.status} />
              </div>
              <p className="mt-1 text-sm text-muted">
                {b.address} · {b.hours}
              </p>
              {b.status === "rejected" && b.reviewNote && <p className="mt-2 text-sm">Admin note: “{b.reviewNote}”</p>}
              {b.license ? (
                <div className="mt-4">
                  <p className="text-xs text-muted">
                    License {b.license.licenseNumber} · valid until {formatDate(b.license.expiresAt)}
                  </p>
                  <QuotaProgress salesCents={b.sales} quotaCents={b.license.quotaCents} />
                </div>
              ) : (
                b.status === "approved" && (
                  <p className="mt-3 text-sm">License expired. Customers can&apos;t order here until the admin issues a new one.</p>
                )
              )}
              {b.status === "approved" && (
                <div className="mt-4 flex flex-wrap gap-4 text-sm font-medium">
                  <Link href={`/branch/${b.id}`} className="text-accent">
                    Orders
                  </Link>
                  <Link href={`/branch/${b.id}/sales`} className="text-accent">
                    Sales
                  </Link>
                  <Link href={`/branch/${b.id}/payroll`} className="text-accent">
                    Payroll
                  </Link>
                  {b.license && (
                    <Link href={`/licenses/${b.license.id}`} className="text-accent">
                      License
                    </Link>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <section className="mt-10 max-w-xl">
        <h2 className="mb-4 text-lg font-semibold">Add a branch</h2>
        <ActionForm action={createBranch} submitLabel="Submit for approval" className={`${cardClass} space-y-4`}>
          <label className="block text-sm font-medium">
            Branch name
            <input name="name" required minLength={2} maxLength={80} placeholder="Brew Lab Makati" className={inputClass} />
          </label>
          <label className="block text-sm font-medium">
            Address
            <input name="address" required minLength={5} maxLength={200} className={inputClass} />
          </label>
          <label className="block text-sm font-medium">
            Opening hours
            <input name="hours" required minLength={3} maxLength={100} placeholder="Mon–Sat 7am–7pm" className={inputClass} />
          </label>
        </ActionForm>
      </section>
    </div>
  );
}

import type { Metadata } from "next";
import { asc, eq } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/db";
import { branches, user } from "@/db/schema";
import { QuotaProgress } from "@/components/quota-progress";
import { Badge, cardClass, formatDate } from "@/components/ui";
import { branchSalesBetween, currentLicense, settleExpiredLicenses } from "@/lib/licenses";
import { requireRole } from "@/lib/session";
import { AreaTitle } from "@/components/area-shell";
import { ReissueButton, RevokeButton, SuspendButton } from "../review-buttons";

export const metadata: Metadata = { title: "Branches" };

export default async function AdminBranchesPage() {
  await requireRole(["super_admin"], "/admin/branches");
  await settleExpiredLicenses();

  const rows = await db
    .select({ branch: branches, ownerEmail: user.email, ownerName: user.name })
    .from(branches)
    .innerJoin(user, eq(branches.managerId, user.id))
    .orderBy(asc(branches.name));

  const list = await Promise.all(
    rows.map(async (row) => {
      const license = await currentLicense(row.branch.id);
      const sales = license ? await branchSalesBetween(row.branch.id, license.issuedAt, license.expiresAt) : 0;
      return { ...row, license, sales };
    }),
  );

  return (
    <div>
      <AreaTitle title="Branches" subtitle="Every branch, its owner and its license. Licenses renew yearly when the branch sells ₱100,000." />
      {list.length === 0 ? (
        <p className="text-muted">No branches yet.</p>
      ) : (
        <ul className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-2">
          {list.map(({ branch: b, ownerEmail, ownerName, license, sales }) => (
            <li key={b.id} className={cardClass}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-display text-xl font-semibold">{b.name}</p>
                  <p className="text-sm text-muted">{b.address}</p>
                  <p className="text-xs text-muted">
                    Owner {ownerName || ownerEmail} · {ownerEmail}
                  </p>
                </div>
                <Badge status={b.status === "approved" && !license ? "unlicensed" : b.status} />
              </div>
              {license ? (
                <div className="mt-4">
                  <p className="text-xs text-muted">
                    <Link href={`/licenses/${license.id}`} className="font-medium text-accent hover:underline">
                      License {license.licenseNumber}
                    </Link>{" "}
                    · {formatDate(license.issuedAt)} – {formatDate(license.expiresAt)}
                  </p>
                  <QuotaProgress salesCents={sales} quotaCents={license.quotaCents} />
                </div>
              ) : (
                b.status === "approved" && <p className="mt-3 text-sm">No active license: hidden from customers.</p>
              )}
              <div className="mt-4 flex flex-wrap justify-end gap-4">
                {b.status === "approved" && !license && <ReissueButton branchId={b.id} />}
                {license && <RevokeButton licenseId={license.id} />}
                {b.status === "approved" && <SuspendButton branchId={b.id} />}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

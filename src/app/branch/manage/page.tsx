import type { Metadata } from "next";
import { desc, eq } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/db";
import { branches } from "@/db/schema";
import { createBranch } from "@/app/actions/branch";
import { ActionForm } from "@/components/action-form";
import { AreaTitle } from "@/components/area-shell";
import { ImageUpload } from "@/components/image-upload";
import { Badge, cardClass, formatDate, inputClass } from "@/components/ui";
import { imageUrl } from "@/lib/images";
import { currentLicense, settleExpiredLicenses } from "@/lib/licenses";
import { requireRole } from "@/lib/session";

export const metadata: Metadata = { title: "Manage branches" };

export default async function ManageBranchesPage() {
  const user = await requireRole(["branch_manager"], "/branch/manage");
  await settleExpiredLicenses();
  const rows = await db.select().from(branches).where(eq(branches.managerId, user.id)).orderBy(desc(branches.createdAt));
  const list = await Promise.all(rows.map(async (b) => ({ ...b, license: await currentLicense(b.id) })));

  return (
    <div>
      <AreaTitle
        title="Manage branches"
        subtitle="Each new branch is reviewed by the admin. Approved branches get a 1-year license that renews when the branch reaches ₱100,000 in sales that year."
      />
      {list.length > 0 && (
        <ul className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-2">
          {list.map((b) => (
            <li key={b.id} className={cardClass}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-display text-xl font-semibold">{b.name}</h2>
                  <p className="mt-1 text-sm text-muted">
                    {b.address} · {b.hours}
                  </p>
                </div>
                <Badge status={b.status === "approved" && !b.license ? "unlicensed" : b.status} />
              </div>
              {b.status === "rejected" && b.reviewNote && <p className="mt-2 text-sm">Admin note: “{b.reviewNote}”</p>}
              {b.license && (
                <p className="mt-3 text-xs text-muted">
                  <Link href={`/licenses/${b.license.id}`} className="font-medium text-accent hover:underline">
                    License {b.license.licenseNumber}
                  </Link>{" "}
                  · valid until {formatDate(b.license.expiresAt)}
                </p>
              )}
              <div className="mt-4 border-t border-line pt-4">
                <ImageUpload
                  target={{ kind: "branch", id: b.id }}
                  currentUrl={imageUrl(b.imageKey)}
                  label="Branch photo"
                  hint="Shown to customers at checkout."
                  shape="wide"
                />
              </div>
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

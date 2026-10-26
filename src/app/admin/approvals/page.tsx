import type { Metadata } from "next";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { branches, managerApplications, user } from "@/db/schema";
import { cardClass, formatDateTime } from "@/components/ui";
import { requireRole } from "@/lib/session";
import { AreaTitle } from "@/components/area-shell";
import { ReviewButtons } from "../review-buttons";

export const metadata: Metadata = { title: "Approvals" };

export default async function ApprovalsPage() {
  await requireRole(["super_admin"], "/admin/approvals");

  const applications = await db
    .select({ application: managerApplications, email: user.email })
    .from(managerApplications)
    .innerJoin(user, eq(managerApplications.userId, user.id))
    .where(eq(managerApplications.status, "pending"))
    .orderBy(asc(managerApplications.createdAt));

  const pendingBranches = await db
    .select({ branch: branches, ownerEmail: user.email, ownerName: user.name })
    .from(branches)
    .innerJoin(user, eq(branches.managerId, user.id))
    .where(eq(branches.status, "pending"))
    .orderBy(asc(branches.createdAt));

  return (
    <div>
      <AreaTitle title="Approvals" subtitle="Verify branch owners, then approve each branch. Approving a branch issues its 1-year license." />

      <section>
        <h2 className="mb-4 text-lg font-semibold">Branch owners to verify ({applications.length})</h2>
        {applications.length === 0 ? (
          <p className="text-muted">Nothing waiting.</p>
        ) : (
          <ul className="grid gap-4 md:grid-cols-2">
            {applications.map(({ application: a, email }) => (
              <li key={a.id} className={cardClass}>
                <p className="font-semibold">{a.fullName}</p>
                <p className="text-sm text-muted">
                  {email} · {a.phone}
                </p>
                <p className="text-xs text-muted">Applied {formatDateTime(a.createdAt)}</p>
                {a.message && <p className="mt-3 rounded-lg bg-accent-soft px-3 py-2 text-sm">“{a.message}”</p>}
                <ReviewButtons kind="owner" id={a.id} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-12">
        <h2 className="mb-4 text-lg font-semibold">Branches waiting to go live ({pendingBranches.length})</h2>
        {pendingBranches.length === 0 ? (
          <p className="text-muted">Nothing waiting.</p>
        ) : (
          <ul className="grid gap-4 md:grid-cols-2">
            {pendingBranches.map(({ branch: b, ownerEmail, ownerName }) => (
              <li key={b.id} className={cardClass}>
                <p className="font-semibold">{b.name}</p>
                <p className="text-sm text-muted">
                  {b.address} · {b.hours}
                </p>
                <p className="text-xs text-muted">
                  Owner {ownerName || ownerEmail} ({ownerEmail}) · submitted {formatDateTime(b.createdAt)}
                </p>
                {b.reviewNote && <p className="mt-2 text-sm">Note: {b.reviewNote}</p>}
                <ReviewButtons kind="branch" id={b.id} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

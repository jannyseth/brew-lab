import type { Metadata } from "next";
import { desc, ilike, or } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/db";
import { auditLogs } from "@/db/schema";
import { buttonSecondary, formatDateTime, inputClass } from "@/components/ui";
import { formatCents } from "@/lib/drink";
import { requireRole } from "@/lib/session";
import { AdminNav } from "../admin-nav";

export const metadata: Metadata = { title: "Admin · Activity log" };

const PAGE_SIZE = 100;

const actionLabels: Record<string, string> = {
  "auth.sign_up": "Created an account",
  "auth.sign_in": "Signed in",
  "auth.password_reset": "Reset their password",
  "owner.applied": "Applied to become a branch owner",
  "owner.approved": "Verified a branch owner",
  "owner.rejected": "Rejected a branch owner",
  "branch.created": "Submitted a new branch",
  "branch.approved": "Approved a branch",
  "branch.rejected": "Rejected a branch",
  "branch.suspended": "Suspended a branch",
  "license.issued": "Issued a license",
  "license.renewed": "License renewed (quota met)",
  "license.expired": "License expired (quota not met)",
  "license.revoked": "Revoked a license",
  "order.placed": "Placed an order",
  "order.status": "Updated an order",
  "order.paid": "Marked an order paid",
  "order.unpaid": "Marked an order unpaid",
  "order.cancelled": "Cancelled an order",
  "drink.saved": "Saved a drink",
  "drink.deleted": "Deleted a saved drink",
  "employee.added": "Added an employee",
  "employee.archived": "Archived an employee",
  "employee.restored": "Restored an employee",
  "payroll.logged": "Logged payroll",
  "payroll.deleted": "Deleted a payroll entry",
};

function describeDetails(details: Record<string, unknown>) {
  return Object.entries(details)
    .filter(([, v]) => v !== null && v !== undefined && v !== "")
    .map(([k, v]) => `${k}: ${k.endsWith("Cents") && typeof v === "number" ? formatCents(v) : String(v)}`)
    .join(" · ");
}

export default async function ActivityPage({ searchParams }: PageProps<"/admin/activity">) {
  await requireRole(["super_admin"], "/admin/activity");
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim().slice(0, 100) : "";
  const page = Math.max(1, Number(params.page) || 1);

  const pattern = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  const rows = await db
    .select()
    .from(auditLogs)
    .where(q ? or(ilike(auditLogs.userEmail, pattern), ilike(auditLogs.action, pattern), ilike(auditLogs.targetId, pattern)) : undefined)
    .orderBy(desc(auditLogs.createdAt))
    .limit(PAGE_SIZE + 1)
    .offset((page - 1) * PAGE_SIZE);
  const hasMore = rows.length > PAGE_SIZE;
  const link = (p: number) => `/admin/activity?${new URLSearchParams({ ...(q && { q }), page: String(p) })}`;

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <AdminNav active="Activity log" subtitle="Who signed in, when, and every change they made. Newest first. Times are Philippine time." />
      <form className="mb-6 flex max-w-lg gap-2">
        <input name="q" defaultValue={q} placeholder="Search by email, action (e.g. order, sign_in) or ID" aria-label="Search the activity log" className={`${inputClass} mt-0`} />
        <button className={buttonSecondary}>Search</button>
      </form>

      {rows.length === 0 ? (
        <p className="text-muted">No activity{q && " matches your search"}.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-line bg-card">
          <table className="w-full text-sm">
            <thead className="text-left text-muted">
              <tr className="border-b border-line">
                <th className="px-4 py-2 font-medium">When</th>
                <th className="px-4 py-2 font-medium">Who</th>
                <th className="px-4 py-2 font-medium">What</th>
                <th className="px-4 py-2 font-medium">Details</th>
                <th className="px-4 py-2 font-medium">IP address</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, PAGE_SIZE).map((r) => (
                <tr key={r.id} className="border-b border-line align-top last:border-0">
                  <td className="whitespace-nowrap px-4 py-2 tabular-nums">{formatDateTime(r.createdAt)}</td>
                  <td className="px-4 py-2">{r.userEmail ?? <span className="text-muted">System</span>}</td>
                  <td className="px-4 py-2">
                    {actionLabels[r.action] ?? r.action}
                    {r.targetType && (
                      <span className="block text-xs text-muted">
                        {r.targetType} #{r.targetId}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-xs text-muted">{describeDetails(r.details)}</td>
                  <td className="px-4 py-2 text-xs text-muted" title={r.userAgent ?? undefined}>
                    {r.ipAddress ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="mt-4 flex justify-between text-sm">
        {page > 1 ? (
          <Link href={link(page - 1)} className="text-accent">
            ← Newer
          </Link>
        ) : (
          <span />
        )}
        {hasMore && (
          <Link href={link(page + 1)} className="text-accent">
            Older →
          </Link>
        )}
      </div>
    </div>
  );
}

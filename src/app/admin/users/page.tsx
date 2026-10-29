import type { Metadata } from "next";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { auditLogs, orders, user } from "@/db/schema";
import { Avatar } from "@/components/avatar";
import { formatDateTime } from "@/components/ui";
import { requireRole } from "@/lib/session";
import { AreaTitle } from "@/components/area-shell";
import { SupportAgentButton } from "./support-agent-button";

export const metadata: Metadata = { title: "Users" };

const roleLabels: Record<string, string> = {
  customer: "Customer",
  branch_applicant: "Owner (unverified)",
  branch_manager: "Branch owner",
  super_admin: "Admin",
  support_agent: "Support agent",
};

export default async function AdminUsersPage() {
  await requireRole(["super_admin"], "/admin/users");

  const lastSignIn = db
    .select({ userId: auditLogs.userId, at: sql<Date>`max(${auditLogs.createdAt})`.as("at") })
    .from(auditLogs)
    .where(eq(auditLogs.action, "auth.sign_in"))
    .groupBy(auditLogs.userId)
    .as("last_sign_in");
  const orderCounts = db
    .select({ userId: orders.userId, n: sql<number>`count(*)::int`.as("n") })
    .from(orders)
    .groupBy(orders.userId)
    .as("order_counts");

  const users = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      image: user.image,
      analyticsConsent: user.analyticsConsent,
      role: user.role,
      verified: user.emailVerified,
      createdAt: user.createdAt,
      lastSignIn: lastSignIn.at,
      orders: orderCounts.n,
    })
    .from(user)
    .leftJoin(lastSignIn, eq(lastSignIn.userId, user.id))
    .leftJoin(orderCounts, eq(orderCounts.userId, user.id))
    .orderBy(desc(user.createdAt))
    .limit(500);

  const counts = Object.entries(roleLabels).map(([role, label]) => ({ label, n: users.filter((u) => u.role === role).length }));

  return (
    <div>
      <AreaTitle title="Users" subtitle="Everyone with an account. Personal data shown here is for administration only." />
      <div className="mb-6 flex flex-wrap gap-3 text-sm">
        {counts.map((c) => (
          <span key={c.label} className="rounded-full border border-line bg-card px-3 py-1">
            {c.label}: <span className="font-semibold">{c.n}</span>
          </span>
        ))}
      </div>
      <div className="overflow-x-auto rounded-2xl border border-line bg-card">
        <table className="w-full text-sm">
          <thead className="text-left text-muted">
            <tr className="border-b border-line">
              <th className="px-4 py-2 font-medium">User</th>
              <th className="px-4 py-2 font-medium">Account</th>
              <th className="px-4 py-2 font-medium">Joined</th>
              <th className="px-4 py-2 font-medium">Last sign-in</th>
              <th className="px-4 py-2 text-right font-medium">Orders</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-line last:border-0">
                <td className="px-4 py-2">
                  <span className="flex items-center gap-3">
                    <Avatar src={u.image} name={u.name || u.email} size={32} />
                    <span>
                      <span className="font-medium">{u.name || "—"}</span>
                      <span className="block text-xs text-muted">
                        {u.email}
                        {!u.verified && " · email not confirmed"}
                        {u.analyticsConsent && " · offers opt-in"}
                      </span>
                    </span>
                  </span>
                </td>
                <td className="px-4 py-2">
                  {roleLabels[u.role] ?? u.role}
                  {(u.role === "customer" || u.role === "support_agent") && u.verified && (
                    <span className="block">
                      <SupportAgentButton userId={u.id} isAgent={u.role === "support_agent"} />
                    </span>
                  )}
                </td>
                <td className="whitespace-nowrap px-4 py-2">{formatDateTime(u.createdAt)}</td>
                <td className="whitespace-nowrap px-4 py-2">{u.lastSignIn ? formatDateTime(new Date(u.lastSignIn)) : "—"}</td>
                <td className="px-4 py-2 text-right tabular-nums">{u.orders ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

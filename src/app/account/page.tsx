import type { Metadata } from "next";
import { desc, eq } from "drizzle-orm";
import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { branches, orders } from "@/db/schema";
import { Avatar } from "@/components/avatar";
import { ReceiptShare } from "@/components/receipt-share";
import { Badge, cardClass, formatDateTime } from "@/components/ui";
import { formatCents } from "@/lib/drink";
import { orderWeek, weekLabel } from "@/lib/receipt-share";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Your account" };

// Sends staff and branch owners to their own area; customers get their account page.
export default async function AccountPage() {
  const user = await requireUser("/account");
  if (user.role === "needs_two_factor") redirect("/account/two-factor");
  if (user.role === "super_admin") redirect("/admin");
  if (user.role === "support_agent") redirect("/admin/support");
  if (user.role === "branch_manager" || user.role === "branch_applicant") redirect("/branch");
  if (user.role === "worker") redirect("/work");

  const rows = await db
    .select({
      id: orders.id,
      status: orders.status,
      totalCents: orders.totalCents,
      createdAt: orders.createdAt,
      week: orderWeek,
      branchName: branches.name,
    })
    .from(orders)
    .innerJoin(branches, eq(orders.branchId, branches.id))
    .where(eq(orders.userId, user.id))
    .orderBy(desc(orders.createdAt))
    .limit(200);

  // Orders grouped by week (Monday to Sunday), newest first.
  const weeks = new Map<string, typeof rows>();
  for (const r of rows) weeks.set(r.week, [...(weeks.get(r.week) ?? []), r]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <div className="mb-8 flex items-center gap-4">
        <Avatar src={user.image} name={user.name || user.email} size={56} />
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-3xl font-semibold tracking-tight">{user.name || "Your account"}</h1>
          <p className="truncate text-sm text-muted">{user.email}</p>
        </div>
      </div>
      <nav className="mb-10 flex flex-wrap gap-2 text-sm font-medium">
        {[
          { href: "/profile", label: "Profile & security" },
          { href: "/rewards", label: "Saved & rewards" },
          { href: "/support", label: "Messages" },
        ].map((l) => (
          <Link key={l.href} href={l.href} className="rounded-full px-4 py-2 ring-1 ring-line hover:ring-accent">
            {l.label}
          </Link>
        ))}
      </nav>

      <h2 className="mb-3 text-lg font-semibold">Orders</h2>
      {rows.length === 0 ? (
        <div className={cardClass}>
          No orders yet.{" "}
          <Link href="/menu" className="font-medium text-accent">
            Order something →
          </Link>
        </div>
      ) : (
        <div className="space-y-8">
          {[...weeks].map(([week, list]) => {
            const kept = list.filter((o) => o.status !== "cancelled");
            const total = kept.reduce((n, o) => n + o.totalCents, 0);
            return (
              <section key={week}>
                <div className="mb-2 flex items-baseline justify-between gap-3">
                  <h3 className="text-sm font-semibold">
                    {weekLabel(week)} <span className="font-normal text-muted">· {formatCents(total)}</span>
                  </h3>
                  {kept.length > 0 && <ReceiptShare target={{ weekStart: week }} label="Share week" />}
                </div>
                <ul className="divide-y divide-line rounded-2xl border border-line bg-card">
                  {list.map((o) => (
                    <li key={o.id} className="flex items-center gap-3 px-4 py-3">
                      <Link href={`/orders/${o.id}`} className="min-w-0 flex-1 hover:text-accent">
                        <span className="block truncate font-medium">{o.branchName}</span>
                        <span className="text-xs text-muted">{formatDateTime(o.createdAt)}</span>
                      </Link>
                      <span className="text-sm tabular-nums">{formatCents(o.totalCents)}</span>
                      <Badge status={o.status} />
                      {o.status !== "cancelled" && <ReceiptShare target={{ orderId: o.id }} />}
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

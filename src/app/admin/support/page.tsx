import type { Metadata } from "next";
import { and, asc, count, desc, eq, isNull, ne, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import Link from "next/link";
import { db } from "@/db";
import { supportTickets, user } from "@/db/schema";
import { AreaTitle } from "@/components/area-shell";
import { AutoRefresh } from "@/components/auto-refresh";
import { staffStatusLabels } from "@/components/support-thread";
import { Badge, formatDateTime } from "@/components/ui";
import { requireRole } from "@/lib/session";
import { supportStaff } from "@/lib/support";

export const metadata: Metadata = { title: "Support inbox" };

const assignee = alias(user, "assignee");

export default async function SupportInboxPage({ searchParams }: PageProps<"/admin/support">) {
  const me = await requireRole(supportStaff, "/admin/support");
  const { view: requested } = await searchParams;

  const notSolved = ne(supportTickets.status, "resolved");
  const views: Record<string, { label: string; where: SQL; oldestFirst?: boolean }> = {
    "needs-reply": { label: "Needs reply", where: eq(supportTickets.status, "open"), oldestFirst: true },
    unassigned: { label: "Unassigned", where: and(notSolved, isNull(supportTickets.assignedTo))!, oldestFirst: true },
    mine: { label: "Mine", where: and(notSolved, eq(supportTickets.assignedTo, me.id))! },
    waiting: { label: "Waiting on customer", where: eq(supportTickets.status, "waiting_customer") },
    solved: { label: "Solved", where: eq(supportTickets.status, "resolved") },
  };
  const key = typeof requested === "string" && requested in views ? requested : "needs-reply";
  const view = views[key];

  const [tickets, ...counts] = await Promise.all([
    db
      .select({
        id: supportTickets.id,
        subject: supportTickets.subject,
        status: supportTickets.status,
        lastMessageAt: supportTickets.lastMessageAt,
        customerName: user.name,
        customerEmail: user.email,
        customerRole: user.role,
        assigneeName: assignee.name,
      })
      .from(supportTickets)
      .innerJoin(user, eq(user.id, supportTickets.userId))
      .leftJoin(assignee, eq(assignee.id, supportTickets.assignedTo))
      .where(view.where)
      // Unanswered tickets oldest first, so nobody waits longest.
      .orderBy(view.oldestFirst ? asc(supportTickets.lastMessageAt) : desc(supportTickets.lastMessageAt))
      .limit(200),
    ...Object.entries(views)
      .filter(([k]) => k !== "solved")
      .map(([k, v]) => db.select({ n: count() }).from(supportTickets).where(v.where).then(([r]) => [k, r.n] as const)),
  ]);
  const countFor = Object.fromEntries(counts);

  return (
    <div>
      <AutoRefresh seconds={30} />
      <AreaTitle
        title="Support inbox"
        subtitle="Messages from customers and branch owners. Customers see replies from “Brew Lab Support”; this inbox and the activity log show who answered."
      />
      <nav aria-label="Inbox views" className="mb-6 flex gap-2 overflow-x-auto pb-1 text-sm">
        {Object.entries(views).map(([k, v]) => (
          <Link
            key={k}
            href={`/admin/support?view=${k}`}
            aria-current={k === key ? "page" : undefined}
            className={`shrink-0 whitespace-nowrap rounded-full border px-3 py-1.5 font-medium ${
              k === key ? "border-accent bg-accent text-accent-contrast" : "border-line hover:border-accent"
            }`}
          >
            {v.label}
            {countFor[k] ? ` (${countFor[k]})` : ""}
          </Link>
        ))}
      </nav>
      {tickets.length === 0 ? (
        <p className="text-muted">Nothing here.</p>
      ) : (
        <ul className="divide-y divide-line rounded-2xl border border-line bg-card">
          {tickets.map((t) => (
            <li key={t.id}>
              <Link href={`/admin/support/${t.id}`} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 hover:bg-accent-soft">
                <span className="min-w-0">
                  <span className="block truncate font-medium">{t.subject}</span>
                  <span className="block truncate text-xs text-muted">
                    #{t.id} · {t.customerName || t.customerEmail}
                    {t.customerRole !== "customer" && " · branch owner"} · {formatDateTime(t.lastMessageAt)} ·{" "}
                    {t.assigneeName ? `with ${t.assigneeName}` : "unassigned"}
                  </span>
                </span>
                <Badge status={t.status} label={staffStatusLabels[t.status]} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

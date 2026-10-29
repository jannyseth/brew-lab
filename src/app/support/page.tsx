import type { Metadata } from "next";
import { desc, eq } from "drizzle-orm";
import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { supportTickets } from "@/db/schema";
import { customerStatusLabels } from "@/components/support-thread";
import { Badge, buttonPrimary, cardClass, formatDateTime, PageTitle } from "@/components/ui";
import { requireUser } from "@/lib/session";
import { isSupportStaff } from "@/lib/support";

export const metadata: Metadata = { title: "Support" };

export default async function SupportPage() {
  const me = await requireUser("/support");
  if (isSupportStaff(me.role)) redirect("/admin/support");

  const tickets = await db
    .select()
    .from(supportTickets)
    .where(eq(supportTickets.userId, me.id))
    .orderBy(desc(supportTickets.lastMessageAt))
    .limit(100);

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <PageTitle title="Support" subtitle="Your messages with the Brew Lab team. We reply here and let you know by email." />
      <Link href="/support/new" className={buttonPrimary}>
        Message us
      </Link>
      {tickets.length === 0 ? (
        <div className={`${cardClass} mt-6`}>
          <p>No messages yet.</p>
          <p className="mt-1 text-sm text-muted">
            Many questions are answered in the{" "}
            <Link href="/faq" className="text-accent hover:underline">
              FAQ
            </Link>
            .
          </p>
        </div>
      ) : (
        <ul className="mt-6 divide-y divide-line rounded-2xl border border-line bg-card">
          {tickets.map((t) => (
            <li key={t.id}>
              <Link href={`/support/${t.id}`} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 hover:bg-accent-soft">
                <span className="min-w-0">
                  <span className="block truncate font-medium">{t.subject}</span>
                  <span className="text-xs text-muted">Last message {formatDateTime(t.lastMessageAt)}</span>
                </span>
                <Badge status={t.status} label={customerStatusLabels[t.status]} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

import type { Metadata } from "next";
import { asc, eq, inArray } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { supportMessages, supportTickets, user } from "@/db/schema";
import { replyAsSupport } from "@/app/actions/support";
import { ActionForm } from "@/components/action-form";
import { AutoRefresh } from "@/components/auto-refresh";
import { staffStatusLabels, SupportThread } from "@/components/support-thread";
import { Badge, cardClass, formatDateTime, inputClass } from "@/components/ui";
import { requireRole } from "@/lib/session";
import { MESSAGE_MAX, supportStaff } from "@/lib/support";
import { TicketControls } from "../support-controls";

export const metadata: Metadata = { title: "Support ticket" };

export default async function AdminTicketPage({ params }: PageProps<"/admin/support/[id]">) {
  const { id } = await params;
  const me = await requireRole(supportStaff, `/admin/support/${id}`);
  const ticketId = Number(id);
  if (!Number.isInteger(ticketId)) notFound();

  const [found] = await db
    .select({ ticket: supportTickets, customer: { name: user.name, email: user.email, role: user.role, createdAt: user.createdAt } })
    .from(supportTickets)
    .innerJoin(user, eq(user.id, supportTickets.userId))
    .where(eq(supportTickets.id, ticketId));
  if (!found) notFound();
  const { ticket, customer } = found;

  const [messages, team] = await Promise.all([
    db
      .select({
        id: supportMessages.id,
        body: supportMessages.body,
        fromSupport: supportMessages.fromSupport,
        internal: supportMessages.internal,
        createdAt: supportMessages.createdAt,
        authorName: user.name,
      })
      .from(supportMessages)
      .leftJoin(user, eq(user.id, supportMessages.authorId))
      .where(eq(supportMessages.ticketId, ticketId))
      .orderBy(asc(supportMessages.createdAt)),
    db
      .select({ id: user.id, name: user.name })
      .from(user)
      .where(inArray(user.role, ["super_admin", "support_agent"]))
      .orderBy(asc(user.name)),
  ]);

  return (
    <div className="max-w-3xl">
      <AutoRefresh seconds={20} />
      <Link href="/admin/support" className="text-sm text-accent hover:underline">
        ← Support inbox
      </Link>
      <div className="mb-6 mt-3 flex flex-wrap items-start justify-between gap-3">
        <h1 className="min-w-0 break-words font-display text-3xl font-semibold tracking-tight">{ticket.subject}</h1>
        <Badge status={ticket.status} label={staffStatusLabels[ticket.status]} />
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_240px]">
        <div>
          <SupportThread messages={messages} staffView />
          <div className="mt-8">
            <ActionForm action={replyAsSupport.bind(null, ticket.id)} submitLabel="Send">
              <label className="block text-sm font-medium">
                Reply
                <textarea name="body" required minLength={2} maxLength={MESSAGE_MAX} rows={5} className={inputClass} />
              </label>
              <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm">
                <label className="flex items-center gap-2">
                  <input type="checkbox" name="resolve" className="h-4 w-4 accent-[var(--accent)]" /> Mark solved after sending
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" name="internal" className="h-4 w-4 accent-[var(--accent)]" /> Internal note (customer won&apos;t see it)
                </label>
              </div>
            </ActionForm>
          </div>
        </div>

        <aside className="space-y-4">
          <section className={`${cardClass} text-sm`}>
            <h2 className="font-semibold">From</h2>
            <p className="mt-1 break-words">{customer.name || "—"}</p>
            <p className="break-words text-muted">{customer.email}</p>
            <p className="mt-1 text-xs text-muted">
              {customer.role === "customer" ? "Customer" : "Branch owner"} since {formatDateTime(customer.createdAt)}
            </p>
            {ticket.topic && <p className="mt-3 text-xs text-muted">Wrote in from the FAQ: “{ticket.topic}”</p>}
            <p className="mt-3 text-xs text-muted">
              Opened {formatDateTime(ticket.createdAt)}
              {ticket.firstResponseAt && (
                <>
                  <br />
                  First reply {formatDateTime(ticket.firstResponseAt)}
                </>
              )}
            </p>
          </section>
          <section className={cardClass}>
            <TicketControls
              ticketId={ticket.id}
              assignedTo={ticket.assignedTo}
              meId={me.id}
              resolved={ticket.status === "resolved"}
              team={team.map((p) => ({ id: p.id, name: p.name || "Unnamed" }))}
            />
          </section>
        </aside>
      </div>
    </div>
  );
}

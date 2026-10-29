import type { Metadata } from "next";
import { and, asc, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { supportMessages, supportTickets } from "@/db/schema";
import { replyAsCustomer } from "@/app/actions/support";
import { ActionForm } from "@/components/action-form";
import { AutoRefresh } from "@/components/auto-refresh";
import { customerStatusLabels, SupportThread } from "@/components/support-thread";
import { Badge, inputClass } from "@/components/ui";
import { requireUser } from "@/lib/session";
import { MESSAGE_MAX } from "@/lib/support";
import { ResolveButton } from "../resolve-button";

export const metadata: Metadata = { title: "Support message" };

export default async function TicketPage({ params, searchParams }: PageProps<"/support/[id]">) {
  const { id } = await params;
  const { sent } = await searchParams;
  const ticketId = Number(id);
  const me = await requireUser(`/support/${id}`);
  if (!Number.isInteger(ticketId)) notFound();

  const [ticket] = await db
    .select()
    .from(supportTickets)
    .where(and(eq(supportTickets.id, ticketId), eq(supportTickets.userId, me.id)));
  if (!ticket) notFound();

  // Internal staff notes are filtered out here, so they never reach the customer's browser.
  const messages = await db
    .select({
      id: supportMessages.id,
      body: supportMessages.body,
      fromSupport: supportMessages.fromSupport,
      internal: supportMessages.internal,
      createdAt: supportMessages.createdAt,
    })
    .from(supportMessages)
    .where(and(eq(supportMessages.ticketId, ticketId), eq(supportMessages.internal, false)))
    .orderBy(asc(supportMessages.createdAt));

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <AutoRefresh seconds={20} />
      <Link href="/support" className="text-sm text-accent hover:underline">
        ← Your messages
      </Link>
      <div className="mb-6 mt-3 flex flex-wrap items-start justify-between gap-3">
        <h1 className="min-w-0 break-words font-display text-3xl font-semibold tracking-tight">{ticket.subject}</h1>
        <Badge status={ticket.status} label={customerStatusLabels[ticket.status]} />
      </div>
      {sent && (
        <p className="mb-6 rounded-2xl bg-accent-soft px-4 py-3 text-sm">
          Message sent. A person from the Brew Lab team will reply here, and we&apos;ll email you when they do.
        </p>
      )}
      <SupportThread messages={messages.map((m) => ({ ...m, authorName: null }))} staffView={false} />
      <div className="mt-8">
        <ActionForm action={replyAsCustomer.bind(null, ticket.id)} submitLabel={ticket.status === "resolved" ? "Reopen and send" : "Send"}>
          <label className="block text-sm font-medium">
            {ticket.status === "resolved" ? "Still need help? Write again to reopen this conversation." : "Add a message"}
            <textarea name="body" required minLength={2} maxLength={MESSAGE_MAX} rows={4} className={inputClass} />
          </label>
        </ActionForm>
        {ticket.status !== "resolved" && (
          <div className="mt-6">
            <ResolveButton ticketId={ticket.id} />
          </div>
        )}
      </div>
    </div>
  );
}

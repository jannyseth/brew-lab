"use server";

import { and, count, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { supportMessages, supportTickets, user } from "@/db/schema";
import type { FormState } from "@/components/action-form";
import { logActivity } from "@/lib/audit";
import { sendSupportReplyNotice } from "@/lib/mail";
import { getSession } from "@/lib/session";
import { isSupportStaff, MAX_OPEN_TICKETS, MESSAGE_MAX, siteUrl, SUBJECT_MAX } from "@/lib/support";

const messageSchema = z.string().trim().min(2, "Write a message first.").max(MESSAGE_MAX, `Keep it under ${MESSAGE_MAX} characters.`);
const onlyStaff: FormState = { ok: false, message: "Only Brew Lab support can do this." };

async function getActor() {
  const session = await getSession();
  if (!session) return null;
  return { id: session.user.id, email: session.user.email, staff: isSupportStaff(session.user.role as string) };
}

function refresh(ticketId: number) {
  revalidatePath(`/support/${ticketId}`);
  revalidatePath("/support");
  revalidatePath("/admin", "layout");
}

/** A customer or branch owner writes to Brew Lab. Opens the new ticket on success. */
export async function openTicket(_: FormState, data: FormData): Promise<FormState> {
  const actor = await getActor();
  if (!actor) return { ok: false, message: "Please sign in first." };
  if (actor.staff) return { ok: false, message: "Support staff can't open tickets for themselves." };

  const parsed = z
    .object({
      subject: z.string().trim().min(3, "Add a short subject.").max(SUBJECT_MAX, `Keep the subject under ${SUBJECT_MAX} characters.`),
      body: messageSchema,
      topic: z.string().trim().max(200).optional(),
    })
    .safeParse({ subject: data.get("subject"), body: data.get("body"), topic: data.get("topic") || undefined });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };

  const [open] = await db
    .select({ n: count() })
    .from(supportTickets)
    .where(and(eq(supportTickets.userId, actor.id), ne(supportTickets.status, "resolved")));
  if (open.n >= MAX_OPEN_TICKETS) {
    return { ok: false, message: `You already have ${open.n} open messages. Please wait for a reply or add to one of them.` };
  }

  const { subject, body, topic } = parsed.data;
  const [ticket] = await db
    .insert(supportTickets)
    .values({ userId: actor.id, subject, topic: topic ?? null })
    .returning({ id: supportTickets.id });
  try {
    await db.insert(supportMessages).values({ ticketId: ticket.id, authorId: actor.id, body });
  } catch (err) {
    await db.delete(supportTickets).where(eq(supportTickets.id, ticket.id));
    throw err;
  }
  await logActivity({ userId: actor.id, userEmail: actor.email, action: "support.opened", targetType: "support_ticket", targetId: ticket.id });
  refresh(ticket.id);
  redirect(`/support/${ticket.id}?sent=1`);
}

/** The ticket owner adds a message. Writing on a resolved ticket reopens it. */
export async function replyAsCustomer(ticketId: number, _: FormState, data: FormData): Promise<FormState> {
  const actor = await getActor();
  if (!actor) return { ok: false, message: "Please sign in first." };
  const body = messageSchema.safeParse(data.get("body"));
  if (!body.success) return { ok: false, message: body.error.issues[0].message };

  const [ticket] = await db
    .update(supportTickets)
    .set({ status: "open", resolvedAt: null, lastMessageAt: new Date() })
    .where(and(eq(supportTickets.id, ticketId), eq(supportTickets.userId, actor.id)))
    .returning({ id: supportTickets.id });
  if (!ticket) return { ok: false, message: "That conversation wasn't found." };

  await db.insert(supportMessages).values({ ticketId, authorId: actor.id, body: body.data });
  await logActivity({ userId: actor.id, userEmail: actor.email, action: "support.customer_replied", targetType: "support_ticket", targetId: ticketId });
  refresh(ticketId);
  return { ok: true, message: "Sent. We'll reply here and by email." };
}

/** The customer says their question is answered. */
export async function resolveOwnTicket(ticketId: number): Promise<FormState> {
  const actor = await getActor();
  if (!actor) return { ok: false, message: "Please sign in first." };
  const [ticket] = await db
    .update(supportTickets)
    .set({ status: "resolved", resolvedAt: new Date() })
    .where(and(eq(supportTickets.id, ticketId), eq(supportTickets.userId, actor.id), ne(supportTickets.status, "resolved")))
    .returning({ id: supportTickets.id });
  if (!ticket) return { ok: false, message: "This conversation is already closed." };
  await logActivity({ userId: actor.id, userEmail: actor.email, action: "support.customer_resolved", targetType: "support_ticket", targetId: ticketId });
  refresh(ticketId);
  return { ok: true, message: "Marked as solved." };
}

/**
 * Support answers, or leaves a note only staff can see. A reply to an
 * unassigned ticket assigns it to whoever answered.
 */
export async function replyAsSupport(ticketId: number, _: FormState, data: FormData): Promise<FormState> {
  const actor = await getActor();
  if (!actor?.staff) return onlyStaff;
  const body = messageSchema.safeParse(data.get("body"));
  if (!body.success) return { ok: false, message: body.error.issues[0].message };
  const internal = data.get("internal") === "on";
  const resolve = !internal && data.get("resolve") === "on";

  const now = new Date();
  const [ticket] = await db
    .update(supportTickets)
    .set(
      internal
        ? { assignedTo: sql`coalesce(${supportTickets.assignedTo}, ${actor.id})` }
        : {
            status: resolve ? "resolved" : "waiting_customer",
            resolvedAt: resolve ? now : null,
            lastMessageAt: now,
            firstResponseAt: sql`coalesce(${supportTickets.firstResponseAt}, now())`,
            assignedTo: sql`coalesce(${supportTickets.assignedTo}, ${actor.id})`,
          },
    )
    .where(eq(supportTickets.id, ticketId))
    .returning({ subject: supportTickets.subject, userId: supportTickets.userId });
  if (!ticket) return { ok: false, message: "That ticket wasn't found." };

  await db.insert(supportMessages).values({ ticketId, authorId: actor.id, fromSupport: true, internal, body: body.data });
  await logActivity({
    userId: actor.id,
    userEmail: actor.email,
    action: internal ? "support.note" : resolve ? "support.replied_resolved" : "support.replied",
    targetType: "support_ticket",
    targetId: ticketId,
  });

  if (!internal) {
    const [customer] = await db.select({ email: user.email }).from(user).where(eq(user.id, ticket.userId));
    if (customer) after(() => sendSupportReplyNotice(customer.email, ticket.subject, siteUrl(`/support/${ticketId}`)));
  }
  refresh(ticketId);
  return { ok: true, message: internal ? "Note saved. The customer can't see it." : resolve ? "Sent and marked solved." : "Sent." };
}

/** Assigns the ticket to a support person, or to nobody when assigneeId is null. */
export async function assignTicket(ticketId: number, assigneeId: string | null): Promise<FormState> {
  const actor = await getActor();
  if (!actor?.staff) return onlyStaff;
  if (assigneeId) {
    const [assignee] = await db
      .select({ id: user.id })
      .from(user)
      .where(and(eq(user.id, assigneeId), inArray(user.role, ["super_admin", "support_agent"])));
    if (!assignee) return { ok: false, message: "That person isn't on the support team." };
  }
  const [ticket] = await db
    .update(supportTickets)
    .set({ assignedTo: assigneeId })
    .where(eq(supportTickets.id, ticketId))
    .returning({ id: supportTickets.id });
  if (!ticket) return { ok: false, message: "That ticket wasn't found." };
  await logActivity({
    userId: actor.id,
    userEmail: actor.email,
    action: "support.assigned",
    targetType: "support_ticket",
    targetId: ticketId,
    details: { assigneeId },
  });
  refresh(ticketId);
  return { ok: true, message: assigneeId ? "Assigned." : "Unassigned." };
}

/** Takes an unassigned ticket. Fails if someone else claimed it first. */
export async function claimTicket(ticketId: number): Promise<FormState> {
  const actor = await getActor();
  if (!actor?.staff) return onlyStaff;
  const [ticket] = await db
    .update(supportTickets)
    .set({ assignedTo: actor.id })
    .where(and(eq(supportTickets.id, ticketId), isNull(supportTickets.assignedTo)))
    .returning({ id: supportTickets.id });
  if (!ticket) return { ok: false, message: "Someone else already took this ticket." };
  await logActivity({ userId: actor.id, userEmail: actor.email, action: "support.claimed", targetType: "support_ticket", targetId: ticketId });
  refresh(ticketId);
  return { ok: true, message: "It's yours." };
}

/** Closes or reopens a ticket without sending a message. */
export async function setTicketResolved(ticketId: number, resolved: boolean): Promise<FormState> {
  const actor = await getActor();
  if (!actor?.staff) return onlyStaff;
  const [ticket] = await db
    .update(supportTickets)
    .set(resolved ? { status: "resolved", resolvedAt: new Date() } : { status: "open", resolvedAt: null })
    .where(eq(supportTickets.id, ticketId))
    .returning({ id: supportTickets.id });
  if (!ticket) return { ok: false, message: "That ticket wasn't found." };
  await logActivity({
    userId: actor.id,
    userEmail: actor.email,
    action: resolved ? "support.resolved" : "support.reopened",
    targetType: "support_ticket",
    targetId: ticketId,
  });
  refresh(ticketId);
  return { ok: true, message: resolved ? "Marked solved." : "Reopened." };
}

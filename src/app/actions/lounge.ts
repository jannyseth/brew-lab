"use server";

import { and, eq, gt, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { chatMessages, conversationMembers, conversations, employees, timeEntries, user, workerInvites } from "@/db/schema";
import type { FormState } from "@/components/action-form";
import { logActivity } from "@/lib/audit";
import { authorizeBranch } from "@/lib/branch-access";
import { getSession } from "@/lib/session";
import {
  branchMembership,
  branchPeople,
  checkClockCode,
  clockedHours,
  confirmOwnPassword,
  conversationFor,
  currentClockCode,
  ensureBranchChats,
  fromLocalInput,
  INVITE_DAYS,
  newToken,
  openShifts,
} from "@/lib/workers";

/** What these actions return: a message, plus where to go next for some of them. */
type Result = { ok: boolean; message: string; link?: string; branchId?: number; path?: string; clockedIn?: boolean };
const fail = (message: string): Result => ({ ok: false, message });
const notAllowed = fail("You don't have access to this branch.");
const wrongPassword = fail("That password isn't right. Use the password you sign in with.");

// ---- Hiring ----

export async function createInvite(branchId: number, _: FormState, data: FormData): Promise<Result> {
  const access = await authorizeBranch(branchId);
  if (!access) return notAllowed;
  if (access.branch.status !== "approved") return fail("You can hire once the admin approves this branch.");
  const parsed = z
    .object({ position: z.string().trim().min(2).max(60), hourlyRate: z.coerce.number().min(0).max(100_000) })
    .safeParse(Object.fromEntries(data));
  if (!parsed.success) return fail("Enter a position and an hourly rate.");

  const token = newToken();
  await db.insert(workerInvites).values({
    token,
    branchId,
    position: parsed.data.position,
    hourlyRateCents: Math.round(parsed.data.hourlyRate * 100),
    createdBy: access.viewer.userId,
    expiresAt: new Date(Date.now() + INVITE_DAYS * 86_400_000),
  });
  await logActivity({ ...access.viewer, action: "worker.invite_created", targetType: "branch", targetId: branchId, details: { position: parsed.data.position } });
  revalidatePath(`/branch/${branchId}/lounge`);
  return { ok: true, message: "Invite link ready. Send it to the person you're hiring.", link: `/join/${token}` };
}

export async function revokeInvite(branchId: number, token: string): Promise<Result> {
  const access = await authorizeBranch(branchId);
  if (!access) return notAllowed;
  await db
    .update(workerInvites)
    .set({ revokedAt: new Date() })
    .where(and(eq(workerInvites.token, token), eq(workerInvites.branchId, branchId), isNull(workerInvites.usedAt)));
  await logActivity({ ...access.viewer, action: "worker.invite_revoked", targetType: "branch", targetId: branchId });
  revalidatePath(`/branch/${branchId}/lounge`);
  return { ok: true, message: "Link turned off." };
}

/**
 * Joins the branch through an invite. A customer account becomes a worker
 * account (its bean coins are kept); branch owners and staff can't join.
 */
export async function acceptInvite(token: string): Promise<Result> {
  const session = await getSession();
  if (!session) return fail("Please sign in first.");
  const me = session.user;
  if (me.role !== "worker" && me.role !== "customer") return fail("This account can't join as a worker. Sign in with another account.");

  // Claim the link first, so it can be used only once.
  const [invite] = await db
    .update(workerInvites)
    .set({ usedBy: me.id, usedAt: new Date() })
    .where(and(eq(workerInvites.token, token), isNull(workerInvites.usedAt), isNull(workerInvites.revokedAt), gt(workerInvites.expiresAt, new Date())))
    .returning();
  if (!invite) return fail("This invite link has expired or was already used. Ask the branch for a new one.");

  const values = { position: invite.position, hourlyRateCents: invite.hourlyRateCents, active: true };
  const [existing] = await db
    .select({ id: employees.id })
    .from(employees)
    .where(and(eq(employees.branchId, invite.branchId), eq(employees.userId, me.id)));
  const [job] = existing
    ? await db.update(employees).set(values).where(eq(employees.id, existing.id)).returning({ id: employees.id })
    : await db
        .insert(employees)
        .values({ branchId: invite.branchId, userId: me.id, name: me.name || me.email, email: me.email, ...values })
        .returning({ id: employees.id });
  if (me.role === "customer") await db.update(user).set({ role: "worker" }).where(eq(user.id, me.id));

  // New workers start reading the branch chat from now, not from its first message.
  await ensureBranchChats([invite.branchId]);
  const [chat] = await db
    .select({ id: conversations.id })
    .from(conversations)
    .where(and(eq(conversations.branchId, invite.branchId), eq(conversations.kind, "branch")));
  if (chat) {
    await db
      .insert(conversationMembers)
      .values({ conversationId: chat.id, userId: me.id, lastReadAt: new Date() })
      .onConflictDoUpdate({ target: [conversationMembers.conversationId, conversationMembers.userId], set: { lastReadAt: new Date() } });
  }

  await logActivity({
    userId: me.id,
    userEmail: me.email,
    action: "worker.joined",
    targetType: "employee",
    targetId: job.id,
    details: { branchId: invite.branchId, position: invite.position, wasCustomer: me.role === "customer" },
  });
  revalidatePath(`/branch/${invite.branchId}/lounge`);
  return { ok: true, message: "You're in.", branchId: invite.branchId };
}

// ---- Chat ----

async function me() {
  const session = await getSession();
  return session ? { id: session.user.id, email: session.user.email } : null;
}

const chatPath = (membership: { kind: string }, branchId: number, id: number) =>
  membership.kind === "owner" ? `/branch/${branchId}/lounge/${id}` : `/work/chat/${id}`;

export async function sendMessage(conversationId: number, body: string): Promise<Result> {
  const viewer = await me();
  if (!viewer) return fail("Please sign in again.");
  const text = body.trim();
  if (!text) return fail("Write a message first.");
  if (text.length > 2000) return fail("Keep messages under 2,000 characters.");
  const conv = await conversationFor(viewer.id, conversationId);
  if (!conv) return fail("You're no longer in this chat.");

  const now = new Date();
  await db.insert(chatMessages).values({ conversationId, authorId: viewer.id, body: text, createdAt: now });
  await db.update(conversations).set({ lastMessageAt: now }).where(eq(conversations.id, conversationId));
  await db
    .insert(conversationMembers)
    .values({ conversationId, userId: viewer.id, lastReadAt: now })
    .onConflictDoUpdate({ target: [conversationMembers.conversationId, conversationMembers.userId], set: { lastReadAt: now } });
  revalidatePath(chatPath(conv.membership, conv.branchId, conversationId));
  return { ok: true, message: "" };
}

export async function markRead(conversationId: number) {
  const viewer = await me();
  if (!viewer || !(await conversationFor(viewer.id, conversationId))) return;
  const now = new Date();
  await db
    .insert(conversationMembers)
    .values({ conversationId, userId: viewer.id, lastReadAt: now })
    .onConflictDoUpdate({ target: [conversationMembers.conversationId, conversationMembers.userId], set: { lastReadAt: now } });
}

/** Opens (or creates) the private chat between the viewer and another person at the branch. */
export async function openDirectChat(branchId: number, otherUserId: string): Promise<Result> {
  const viewer = await me();
  if (!viewer) return fail("Please sign in again.");
  if (otherUserId === viewer.id) return fail("Choose someone else.");
  const [mine, theirs] = await Promise.all([branchMembership(viewer.id, branchId), branchMembership(otherUserId, branchId)]);
  if (!mine || !theirs) return fail("You can only message people at your branch.");

  const dmKey = [branchId, ...[viewer.id, otherUserId].sort()].join(":");
  const [created] = await db
    .insert(conversations)
    .values({ branchId, kind: "dm", dmKey, createdBy: viewer.id })
    .onConflictDoNothing()
    .returning({ id: conversations.id });
  const id = created?.id ?? (await db.select({ id: conversations.id }).from(conversations).where(eq(conversations.dmKey, dmKey)))[0].id;
  if (created) {
    await db.insert(conversationMembers).values([
      { conversationId: id, userId: viewer.id },
      { conversationId: id, userId: otherUserId },
    ]);
  }
  return { ok: true, message: "", path: chatPath(mine, branchId, id) };
}

/** A group chat with chosen people from the same branch. */
export async function createGroup(branchId: number, _: FormState, data: FormData): Promise<Result> {
  const viewer = await me();
  if (!viewer) return fail("Please sign in again.");
  const membership = await branchMembership(viewer.id, branchId);
  if (!membership) return notAllowed;
  const title = String(data.get("title") ?? "").trim();
  if (title.length < 2 || title.length > 60) return fail("Give the group a name (2–60 characters).");
  const people = new Set((await branchPeople(branchId)).map((p) => p.userId));
  const chosen = [...new Set(data.getAll("members").map(String))].filter((id) => id !== viewer.id && people.has(id));
  if (chosen.length === 0) return fail("Pick at least one person.");

  const [conv] = await db.insert(conversations).values({ branchId, kind: "group", title, createdBy: viewer.id }).returning({ id: conversations.id });
  await db.insert(conversationMembers).values([viewer.id, ...chosen].map((userId) => ({ conversationId: conv.id, userId })));
  await logActivity({ userId: viewer.id, userEmail: viewer.email, action: "chat.group_created", targetType: "conversation", targetId: conv.id, details: { branchId, members: chosen.length + 1 } });
  return { ok: true, message: "", path: chatPath(membership, branchId, conv.id) };
}

/** Leaves a group chat. The branch chat and DMs can't be left. */
export async function leaveGroup(conversationId: number): Promise<Result> {
  const viewer = await me();
  if (!viewer) return fail("Please sign in again.");
  const conv = await conversationFor(viewer.id, conversationId);
  if (!conv || conv.kind !== "group") return fail("Only group chats can be left.");
  await db.delete(conversationMembers).where(and(eq(conversationMembers.conversationId, conversationId), eq(conversationMembers.userId, viewer.id)));
  return { ok: true, message: "You left the group.", path: conv.membership.kind === "owner" ? `/branch/${conv.branchId}/lounge` : "/work" };
}

// ---- Clock ----

/** For the counter screen: this minute's code and who is on the clock. Owner only. */
export async function counterClock(branchId: number) {
  const access = await authorizeBranch(branchId);
  if (!access || access.branch.status !== "approved") return null;
  const staff = await db
    .select({ id: employees.id, name: employees.name })
    .from(employees)
    .where(and(eq(employees.branchId, branchId), eq(employees.active, true)));
  const open = await openShifts(staff.map((s) => s.id));
  return {
    ...currentClockCode(branchId),
    onClock: staff.filter((s) => open.has(s.id)).map((s) => ({ name: s.name, since: open.get(s.id)!.toISOString() })),
  };
}

/** Clocks the signed-in worker in or out, using the code they scanned at the counter. */
export async function clockPunch(branchId: number, code: string): Promise<Result> {
  const session = await getSession();
  if (!session) return fail("Please sign in again.");
  const membership = await branchMembership(session.user.id, branchId);
  if (!membership || membership.kind !== "worker") return fail("You're not on this branch's team.");
  if (!checkClockCode(branchId, code)) return fail("That code has changed. Scan the QR code at the counter again.");

  const viewer = { userId: session.user.id, userEmail: session.user.email };
  const employeeId = membership.employeeId;
  const [open] = await db
    .update(timeEntries)
    .set({ clockOut: new Date() })
    .where(and(eq(timeEntries.employeeId, employeeId), isNull(timeEntries.clockOut)))
    .returning({ id: timeEntries.id });
  if (open) {
    await logActivity({ ...viewer, action: "clock.out", targetType: "time_entry", targetId: open.id, details: { branchId } });
    revalidatePath("/work");
    return { ok: true, message: "Clocked out. Thanks for your shift!", clockedIn: false };
  }
  const [entry] = await db
    .insert(timeEntries)
    .values({ branchId, employeeId, clockIn: new Date(), source: "qr" })
    .onConflictDoNothing()
    .returning({ id: timeEntries.id });
  if (!entry) return fail("You're already clocked in.");
  await logActivity({ ...viewer, action: "clock.in", targetType: "time_entry", targetId: entry.id, details: { branchId } });
  revalidatePath("/work");
  return { ok: true, message: "Clocked in. Have a good shift!", clockedIn: true };
}

/** Clocked hours for one employee and pay period, for the payroll form. */
export async function hoursForPeriod(branchId: number, employeeId: number, start: string, end: string) {
  const access = await authorizeBranch(branchId);
  if (!access || !/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) return null;
  const [employee] = await db
    .select({ id: employees.id })
    .from(employees)
    .where(and(eq(employees.id, employeeId), eq(employees.branchId, branchId)));
  if (!employee) return null;
  return (await clockedHours([employeeId], start, end)).get(employeeId) ?? { hours: 0, shifts: 0, open: 0 };
}

/**
 * Adds a shift by hand or fixes one (e.g. a forgotten clock-out). Hours drive
 * payroll, so the owner must type their password, and the change is logged.
 */
export async function saveTimeEntry(branchId: number, entryId: number | null, _: FormState, data: FormData): Promise<Result> {
  const access = await authorizeBranch(branchId);
  if (!access) return notAllowed;
  if (!(await confirmOwnPassword(String(data.get("password") ?? "")))) return wrongPassword;

  const employeeId = Number(data.get("employeeId"));
  const clockIn = fromLocalInput(String(data.get("clockIn") ?? ""));
  const clockOut = fromLocalInput(String(data.get("clockOut") ?? ""));
  const note = String(data.get("note") ?? "").trim().slice(0, 200);
  if (!clockIn || !clockOut) return fail("Enter both the clock-in and clock-out times.");
  if (clockOut <= clockIn) return fail("Clock-out must be after clock-in.");
  if (clockOut.getTime() - clockIn.getTime() > 24 * 3_600_000) return fail("A shift can't be longer than 24 hours.");
  if (clockOut > new Date()) return fail("Clock-out can't be in the future.");
  if (note.length < 3) return fail("Say why the times changed (e.g. forgot to clock out).");

  const [employee] = await db
    .select({ id: employees.id })
    .from(employees)
    .where(and(eq(employees.id, employeeId), eq(employees.branchId, branchId)));
  if (!employee) return fail("Choose someone from this branch.");

  const values = { clockIn, clockOut, source: "manual", editedBy: access.viewer.userId, editNote: note };
  let id = entryId;
  let before: { clockIn: Date; clockOut: Date | null } | undefined;
  if (entryId) {
    [before] = await db
      .select({ clockIn: timeEntries.clockIn, clockOut: timeEntries.clockOut })
      .from(timeEntries)
      .where(and(eq(timeEntries.id, entryId), eq(timeEntries.branchId, branchId), eq(timeEntries.employeeId, employeeId)));
    if (!before) return fail("That shift wasn't found.");
    await db.update(timeEntries).set(values).where(eq(timeEntries.id, entryId));
  } else {
    [{ id }] = await db.insert(timeEntries).values({ branchId, employeeId, ...values }).returning({ id: timeEntries.id });
  }
  await logActivity({
    ...access.viewer,
    action: entryId ? "clock.entry_edited" : "clock.entry_added",
    targetType: "time_entry",
    targetId: id ?? undefined,
    details: { branchId, employeeId, before, after: { clockIn, clockOut }, note },
  });
  revalidatePath(`/branch/${branchId}/payroll`);
  return { ok: true, message: entryId ? "Shift updated." : "Shift added." };
}

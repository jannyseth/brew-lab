import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { and, asc, desc, eq, gt, inArray, isNotNull, isNull, or, sql } from "drizzle-orm";
import { headers } from "next/headers";
import { db } from "@/db";
import { branches, chatMessages, conversationMembers, conversations, employees, timeEntries, user, workerInvites } from "@/db/schema";
import { auth } from "./auth";
import { localTime } from "./timezone";

// Workers, the employee lounge chat and the counter clock. The branch owner and
// the branch's active workers with accounts are "the branch"; everything here
// checks that membership again on every request, so archiving a worker cuts
// their access at once.

export const INVITE_DAYS = 7;
/** A shift longer than this was probably never clocked out. */
export const LONG_SHIFT_HOURS = 16;

export type Membership = { kind: "owner" } | { kind: "worker"; employeeId: number };

/** How this user belongs to the branch, or null if they don't. Only approved branches have a lounge. */
export async function branchMembership(userId: string, branchId: number): Promise<Membership | null> {
  if (!Number.isInteger(branchId)) return null;
  const [branch] = await db
    .select({ managerId: branches.managerId, status: branches.status })
    .from(branches)
    .where(eq(branches.id, branchId));
  if (!branch || branch.status !== "approved") return null;
  if (branch.managerId === userId) return { kind: "owner" };
  const [job] = await db
    .select({ id: employees.id })
    .from(employees)
    .where(and(eq(employees.branchId, branchId), eq(employees.userId, userId), eq(employees.active, true)));
  return job ? { kind: "worker", employeeId: job.id } : null;
}

/** Ids of every approved branch this user owns or works at. */
export async function branchIdsFor(userId: string) {
  const [owned, jobs] = await Promise.all([
    db
      .select({ id: branches.id })
      .from(branches)
      .where(and(eq(branches.managerId, userId), eq(branches.status, "approved"))),
    db
      .select({ id: employees.branchId })
      .from(employees)
      .innerJoin(branches, eq(employees.branchId, branches.id))
      .where(and(eq(employees.userId, userId), eq(employees.active, true), eq(branches.status, "approved"))),
  ]);
  return [...new Set([...owned, ...jobs].map((b) => b.id))];
}

/** The owner and the active workers with accounts: everyone who can chat at this branch. */
export async function branchPeople(branchId: number) {
  const [owner] = await db
    .select({ userId: user.id, name: user.name, image: user.image })
    .from(branches)
    .innerJoin(user, eq(branches.managerId, user.id))
    .where(eq(branches.id, branchId));
  const workers = await db
    .select({ userId: user.id, name: user.name, image: user.image, position: employees.position, employeeId: employees.id })
    .from(employees)
    .innerJoin(user, eq(employees.userId, user.id))
    .where(and(eq(employees.branchId, branchId), eq(employees.active, true)))
    .orderBy(asc(user.name));
  return [...(owner ? [{ ...owner, position: "Owner", employeeId: null as number | null }] : []), ...workers];
}

/** Makes sure each branch has its "everyone" chat. */
export async function ensureBranchChats(branchIds: number[]) {
  if (branchIds.length === 0) return;
  await db
    .insert(conversations)
    .values(branchIds.map((branchId) => ({ branchId, kind: "branch" as const })))
    .onConflictDoNothing();
}

/** The conversation, if this user may read and write in it right now. */
export async function conversationFor(userId: string, conversationId: number) {
  if (!Number.isInteger(conversationId)) return null;
  const [conv] = await db.select().from(conversations).where(eq(conversations.id, conversationId));
  if (!conv) return null;
  const membership = await branchMembership(userId, conv.branchId);
  if (!membership) return null;
  if (conv.kind !== "branch") {
    const [member] = await db
      .select({ userId: conversationMembers.userId })
      .from(conversationMembers)
      .where(and(eq(conversationMembers.conversationId, conv.id), eq(conversationMembers.userId, userId)));
    if (!member) return null;
  }
  return { ...conv, membership };
}

/** Every chat this user can see, newest first, with unread counts and a preview. */
export async function conversationList(userId: string, branchIds: number[]) {
  if (branchIds.length === 0) return [];
  await ensureBranchChats(branchIds);
  const rows = await db
    .select({
      id: conversations.id,
      kind: conversations.kind,
      title: conversations.title,
      branchId: conversations.branchId,
      branchName: branches.name,
      lastMessageAt: conversations.lastMessageAt,
      // For a DM, the other person's name.
      otherName: sql<string | null>`(
        select u.name from conversation_members cm join "user" u on u.id = cm.user_id
        where cm.conversation_id = ${conversations.id} and cm.user_id <> ${userId} limit 1
      )`,
      preview: sql<string | null>`(select m.body from chat_messages m where m.conversation_id = ${conversations.id} order by m.id desc limit 1)`,
      unread: sql<number>`(
        select count(*)::int from chat_messages m
        where m.conversation_id = ${conversations.id}
          and m.author_id is distinct from ${userId}
          and m.created_at > coalesce(${conversationMembers.lastReadAt}, ${conversationMembers.joinedAt}, 'epoch'::timestamp)
      )`,
    })
    .from(conversations)
    .innerJoin(branches, eq(conversations.branchId, branches.id))
    .leftJoin(conversationMembers, and(eq(conversationMembers.conversationId, conversations.id), eq(conversationMembers.userId, userId)))
    .where(and(inArray(conversations.branchId, branchIds), or(eq(conversations.kind, "branch"), isNotNull(conversationMembers.userId))))
    .orderBy(desc(conversations.lastMessageAt));
  return rows.map((r) => ({ ...r, name: chatName(r) }));
}

export function chatName(c: { kind: string; title: string | null; branchName: string; otherName?: string | null }) {
  if (c.kind === "branch") return `Everyone at ${c.branchName}`;
  if (c.kind === "dm") return c.otherName ?? "Former coworker";
  return c.title ?? "Group chat";
}

/** The latest messages of a conversation, oldest first. */
export async function recentMessages(conversationId: number, limit = 100) {
  const rows = await db
    .select({ id: chatMessages.id, body: chatMessages.body, createdAt: chatMessages.createdAt, authorId: chatMessages.authorId, authorName: user.name, authorImage: user.image })
    .from(chatMessages)
    .leftJoin(user, eq(chatMessages.authorId, user.id))
    .where(eq(chatMessages.conversationId, conversationId))
    .orderBy(desc(chatMessages.id))
    .limit(limit);
  return rows.reverse();
}

/** A new random token for invite links. */
export const newToken = () => crypto.randomUUID().replaceAll("-", "");

/** For the join page: the branch behind an invite, if the link still works. */
export async function inviteDetails(token: string) {
  if (!/^[a-f0-9]{32}$/.test(token)) return null;
  const [row] = await db
    .select({ invite: workerInvites, branchName: branches.name, address: branches.address })
    .from(workerInvites)
    .innerJoin(branches, eq(workerInvites.branchId, branches.id))
    .where(eq(workerInvites.token, token));
  if (!row) return null;
  const usable = !row.invite.usedAt && !row.invite.revokedAt && row.invite.expiresAt > new Date();
  return { ...row, usable };
}

/** Open invites (not used, revoked or expired) for a branch. */
export async function openInvites(branchId: number) {
  return db
    .select()
    .from(workerInvites)
    .where(and(eq(workerInvites.branchId, branchId), isNull(workerInvites.usedAt), isNull(workerInvites.revokedAt), gt(workerInvites.expiresAt, new Date())))
    .orderBy(desc(workerInvites.createdAt));
}

// ---- The counter clock ----
// The counter screen shows a QR code that changes every minute. Workers scan it
// with their phone to clock in or out, so they have to be at the shop.

const CLOCK_WINDOW_MS = 60_000;

function clockCodeFor(branchId: number, window: number) {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) throw new Error("BETTER_AUTH_SECRET is not set");
  return createHmac("sha256", secret).update(`clock:${branchId}:${window}`).digest("base64url").slice(0, 12);
}

export function currentClockCode(branchId: number) {
  const window = Math.floor(Date.now() / CLOCK_WINDOW_MS);
  return { code: clockCodeFor(branchId, window), expiresAt: (window + 1) * CLOCK_WINDOW_MS };
}

/** True for this minute's code or the previous one, so a scan right at the change still works. */
export function checkClockCode(branchId: number, code: string) {
  const window = Math.floor(Date.now() / CLOCK_WINDOW_MS);
  const given = Buffer.from(code);
  return [window, window - 1].some((w) => {
    const expected = Buffer.from(clockCodeFor(branchId, w));
    return expected.length === given.length && timingSafeEqual(expected, given);
  });
}

/** The open shift of each given employee, if they are clocked in. */
export async function openShifts(employeeIds: number[]) {
  if (employeeIds.length === 0) return new Map<number, Date>();
  const rows = await db
    .select({ employeeId: timeEntries.employeeId, clockIn: timeEntries.clockIn })
    .from(timeEntries)
    .where(and(inArray(timeEntries.employeeId, employeeIds), isNull(timeEntries.clockOut)));
  return new Map(rows.map((r) => [r.employeeId, r.clockIn]));
}

/**
 * Clocked hours per employee for shifts that started between two local dates
 * (inclusive). Shifts still open are counted separately and not paid until closed.
 */
export async function clockedHours(employeeIds: number[], start: string, end: string) {
  if (employeeIds.length === 0) return new Map<number, { hours: number; shifts: number; open: number }>();
  const rows = await db
    .select({
      employeeId: timeEntries.employeeId,
      hours: sql<string>`coalesce(sum(extract(epoch from (${timeEntries.clockOut} - ${timeEntries.clockIn})) / 3600), 0)`,
      shifts: sql<number>`count(${timeEntries.clockOut})::int`,
      open: sql<number>`(count(*) - count(${timeEntries.clockOut}))::int`,
    })
    .from(timeEntries)
    .where(and(inArray(timeEntries.employeeId, employeeIds), sql`${localTime(timeEntries.clockIn)}::date between ${start}::date and ${end}::date`))
    .groupBy(timeEntries.employeeId);
  return new Map(rows.map((r) => [r.employeeId, { hours: Math.round(Number(r.hours) * 100) / 100, shifts: r.shifts, open: r.open }]));
}

/** Monday to Sunday of the current week in the shop's timezone, as YYYY-MM-DD. */
export function thisWeek() {
  const today = new Date(`${toLocalInput(new Date()).slice(0, 10)}T00:00:00Z`);
  const monday = new Date(today.getTime() - ((today.getUTCDay() + 6) % 7) * 86_400_000);
  const sunday = new Date(monday.getTime() + 6 * 86_400_000);
  return { start: monday.toISOString().slice(0, 10), end: sunday.toISOString().slice(0, 10) };
}

// ---- Shop-time conversions for <input type="datetime-local"> ----

const zone = () => process.env.NEXT_PUBLIC_TIMEZONE || "UTC";

/** "YYYY-MM-DDTHH:mm" in the shop's timezone. */
export function toLocalInput(date: Date) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: zone(), year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

/** The moment a shop-time "YYYY-MM-DDTHH:mm" refers to, or null if it isn't valid. */
export function fromLocalInput(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const asUtc = new Date(`${value}:00Z`);
  if (Number.isNaN(asUtc.getTime())) return null;
  // Shift by the zone's offset at that moment (checked twice for DST changes).
  let guess = asUtc.getTime();
  for (let i = 0; i < 2; i++) {
    const shown = new Date(`${toLocalInput(new Date(guess))}:00Z`).getTime();
    guess -= shown - asUtc.getTime();
  }
  return new Date(guess);
}

// ---- Re-entering the owner's password ----

/** True when the signed-in user typed their own account password. */
export async function confirmOwnPassword(password: string) {
  if (!password) return false;
  try {
    await auth.api.verifyPassword({ body: { password }, headers: await headers() });
    return true;
  } catch {
    return false;
  }
}

/** Everything a chat page shows, or null if this user can't open it. */
export async function chatPageData(userId: string, conversationId: number) {
  const conv = await conversationFor(userId, conversationId);
  if (!conv) return null;
  const [[branch], members, messages] = await Promise.all([
    db.select({ name: branches.name }).from(branches).where(eq(branches.id, conv.branchId)),
    conv.kind === "branch"
      ? branchPeople(conv.branchId)
      : db
          .select({ userId: user.id, name: user.name })
          .from(conversationMembers)
          .innerJoin(user, eq(conversationMembers.userId, user.id))
          .where(eq(conversationMembers.conversationId, conv.id)),
    recentMessages(conv.id),
  ]);
  const others = members.filter((m) => m.userId !== userId);
  return {
    conversationId: conv.id,
    branchId: conv.branchId,
    title: chatName({ kind: conv.kind, title: conv.title, branchName: branch.name, otherName: others[0]?.name }),
    subtitle: conv.kind === "dm" ? branch.name : `${members.length} people · ${others.map((m) => m.name.split(" ")[0]).join(", ")}`,
    messages,
    canLeave: conv.kind === "group",
  };
}

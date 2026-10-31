import "server-only";
import { and, desc, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { employees, orderItems, orders, timeEntries, user } from "@/db/schema";

// A claimed order that hasn't moved for this long is flagged so the owner can step in.
export const STUCK_MINUTES = 15;

export const OPEN_STATUSES = ["placed", "preparing", "ready"] as const;

export type BoardOrder = Awaited<ReturnType<typeof openOrders>>[number];

/** Open orders at a branch with their items and who has dibs, oldest first. */
export async function openOrders(branchId: number) {
  const rows = await db
    .select({ order: orders, makerName: employees.name })
    .from(orders)
    .leftJoin(employees, eq(orders.makerId, employees.id))
    .where(and(eq(orders.branchId, branchId), inArray(orders.status, [...OPEN_STATUSES])))
    .orderBy(orders.createdAt)
    .limit(100);
  const items = rows.length
    ? await db
        .select()
        .from(orderItems)
        .where(inArray(orderItems.orderId, rows.map((r) => r.order.id)))
    : [];
  const now = Date.now();
  return rows.map(({ order, makerName }) => ({
    ...order,
    makerName,
    items: items.filter((i) => i.orderId === order.id),
    stuck:
      order.makerId !== null &&
      order.status === "preparing" &&
      now - Math.max(order.updatedAt.getTime(), order.claimedAt?.getTime() ?? 0) > STUCK_MINUTES * 60_000,
  }));
}

/** Waiting for someone to call dibs. A "preparing" order with no maker is one the owner is making. */
export const isUpForGrabs = (o: { status: string }) => o.status === "placed";

/**
 * Everyone clocked in at the branch right now, with how many orders they've
 * finished since their shift started.
 */
export async function onShift(branchId: number) {
  const rows = await db
    .select({
      employeeId: employees.id,
      userId: employees.userId,
      name: employees.name,
      image: user.image,
      position: employees.position,
      since: timeEntries.clockIn,
      done: sql<number>`(
        select count(*)::int from ${orders}
        where ${orders.makerId} = ${employees.id}
          and ${orders.status} = 'completed'
          and ${orders.completedAt} >= ${timeEntries.clockIn}
      )`,
    })
    .from(timeEntries)
    .innerJoin(employees, eq(timeEntries.employeeId, employees.id))
    .leftJoin(user, eq(employees.userId, user.id))
    .where(and(eq(timeEntries.branchId, branchId), isNull(timeEntries.clockOut), eq(employees.active, true)))
    .orderBy(timeEntries.clockIn);
  return rows;
}

/** The open shift for this employee at this branch, if they're clocked in. */
export async function openShiftFor(employeeId: number, branchId: number) {
  const [shift] = await db
    .select({ id: timeEntries.id, clockIn: timeEntries.clockIn })
    .from(timeEntries)
    .where(and(eq(timeEntries.employeeId, employeeId), eq(timeEntries.branchId, branchId), isNull(timeEntries.clockOut)));
  return shift ?? null;
}

/**
 * Hands orders still being made back to the queue when their maker clocks out
 * or leaves. Ready orders stay credited to the maker; anyone can hand them over.
 */
export async function releaseClaims(employeeId: number) {
  return db
    .update(orders)
    .set({ makerId: null, claimedAt: null, status: "placed" })
    .where(and(eq(orders.makerId, employeeId), inArray(orders.status, ["placed", "preparing"])))
    .returning({ id: orders.id, branchId: orders.branchId });
}

/** Finished orders, newest first, with who made them: the branch's receipts log. */
export async function receiptLog(branchId: number, limit = 50) {
  return db
    .select({
      id: orders.id,
      completedAt: orders.completedAt,
      totalCents: orders.totalCents,
      pickupName: orders.pickupName,
      makerName: employees.name,
    })
    .from(orders)
    .leftJoin(employees, eq(orders.makerId, employees.id))
    .where(and(eq(orders.branchId, branchId), eq(orders.status, "completed"), isNotNull(orders.completedAt)))
    .orderBy(desc(orders.completedAt))
    .limit(limit);
}

/** Orders this worker made (any of their jobs), newest first. */
export async function madeBy(employeeIds: number[], limit = 20) {
  if (employeeIds.length === 0) return [];
  return db
    .select({ id: orders.id, branchId: orders.branchId, completedAt: orders.completedAt, totalCents: orders.totalCents })
    .from(orders)
    .where(and(inArray(orders.makerId, employeeIds), eq(orders.status, "completed")))
    .orderBy(desc(orders.completedAt))
    .limit(limit);
}

"use server";

import { and, eq, inArray, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { branches, employees, orders } from "@/db/schema";
import type { FormState } from "@/components/action-form";
import { logActivity } from "@/lib/audit";
import { authorizeBranch } from "@/lib/branch-access";
import { awardCoinsForOrder } from "@/lib/coins";
import { openShiftFor } from "@/lib/order-board";
import { getSession } from "@/lib/session";
import { branchMembership } from "@/lib/workers";

const fail = (message: string): NonNullable<FormState> => ({ ok: false, message });
const notAllowed = fail("You don't have access to this order.");

function refresh(branchId: number) {
  revalidatePath(`/branch/${branchId}`, "layout");
  revalidatePath("/work", "layout");
}

/** The order and the worker acting on it, only if they're clocked in at its branch right now. */
async function workerOnShift(orderId: number) {
  const session = await getSession();
  if (!session) return { error: fail("Please sign in again.") };
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId));
  if (!order) return { error: notAllowed };
  const membership = await branchMembership(session.user.id, order.branchId);
  if (membership?.kind !== "worker") return { error: notAllowed };
  if (!(await openShiftFor(membership.employeeId, order.branchId))) {
    return { error: fail("Clock in at the counter first. Orders open up once your shift starts.") };
  }
  return { order, employeeId: membership.employeeId, viewer: { userId: session.user.id, userEmail: session.user.email } };
}

// ---- Workers ----

/** Calls dibs: the first worker to tap gets the order and starts making it. */
export async function claimOrder(orderId: number): Promise<FormState> {
  const access = await workerOnShift(orderId);
  if (access.error) return access.error;
  const { order, employeeId, viewer } = access;
  // The makerId condition makes dibs first-come: a second tap finds no row to update.
  const claimed = await db
    .update(orders)
    .set({ makerId: employeeId, claimedAt: new Date(), status: "preparing" })
    .where(and(eq(orders.id, orderId), isNull(orders.makerId), eq(orders.status, "placed")))
    .returning({ id: orders.id });
  refresh(order.branchId);
  if (claimed.length === 0) return fail("Someone else picked this up first.");
  await logActivity({ ...viewer, action: "order.claimed", targetType: "order", targetId: orderId, details: { employeeId } });
  return { ok: true, message: `Order #${orderId} is yours.` };
}

/** Gives an order back to the queue so someone else can make it. */
export async function releaseOrder(orderId: number): Promise<FormState> {
  const access = await workerOnShift(orderId);
  if (access.error) return access.error;
  const { order, employeeId, viewer } = access;
  const released = await db
    .update(orders)
    .set({ makerId: null, claimedAt: null, status: "placed" })
    .where(and(eq(orders.id, orderId), eq(orders.makerId, employeeId), inArray(orders.status, ["placed", "preparing"])))
    .returning({ id: orders.id });
  refresh(order.branchId);
  if (released.length === 0) return fail("This order isn't yours to give back.");
  await logActivity({ ...viewer, action: "order.released", targetType: "order", targetId: orderId, details: { employeeId } });
  return { ok: true, message: `Order #${orderId} is back up for grabs.` };
}

/**
 * Moves an order on. Only its maker marks it ready; once it's ready, anyone on
 * shift can hand it over at the counter (the maker keeps the credit).
 */
export async function workerAdvance(orderId: number): Promise<FormState> {
  const access = await workerOnShift(orderId);
  if (access.error) return access.error;
  const { order, employeeId, viewer } = access;
  let next: "ready" | "completed";
  if (order.status === "preparing") {
    if (order.makerId !== employeeId) return fail("Pick up this order first.");
    next = "ready";
  } else if (order.status === "ready") {
    if (!order.paidAt) return fail("Tap Payment received before marking it done.");
    next = "completed";
  } else {
    return fail(order.status === "placed" ? "Pick up this order first." : "This order is already finished.");
  }
  const updated = await db
    .update(orders)
    .set({ status: next, ...(next === "completed" && { completedAt: new Date() }) })
    .where(and(eq(orders.id, orderId), eq(orders.status, order.status)))
    .returning({ id: orders.id });
  refresh(order.branchId);
  if (updated.length === 0) return fail("Someone else just updated this order.");
  if (next === "completed") after(() => awardCoinsForOrder(orderId));
  await logActivity({ ...viewer, action: "order.status", targetType: "order", targetId: orderId, details: { from: order.status, to: next, employeeId } });
  return { ok: true, message: next === "ready" ? `Order #${orderId} is ready for pickup.` : `Order #${orderId} is done.` };
}

/** Workers take payment at the counter too. */
export async function workerSetPaid(orderId: number, paid: boolean): Promise<FormState> {
  const access = await workerOnShift(orderId);
  if (access.error) return access.error;
  const { order, employeeId, viewer } = access;
  if (order.status === "cancelled" || order.status === "completed") return fail("This order is already finished.");
  await db
    .update(orders)
    .set({ paidAt: paid ? new Date() : null })
    .where(eq(orders.id, orderId));
  await logActivity({
    ...viewer,
    action: paid ? "order.paid" : "order.unpaid",
    targetType: "order",
    targetId: orderId,
    details: { totalCents: order.totalCents, employeeId },
  });
  refresh(order.branchId);
  return { ok: true, message: paid ? "Marked as paid." : "Marked as unpaid." };
}

// ---- The branch owner ----

/**
 * Steps in on an order: give it to a worker who's on shift, or (employeeId null)
 * put it back up for grabs. The owner makes one themselves with "Start preparing".
 */
export async function assignOrder(orderId: number, employeeId: number | null): Promise<FormState> {
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId));
  if (!order) return notAllowed;
  const access = await authorizeBranch(order.branchId);
  if (!access) return notAllowed;
  if (order.status !== "placed" && order.status !== "preparing") return fail("Only orders not yet ready can be reassigned.");
  if (employeeId !== null) {
    const [employee] = await db
      .select({ id: employees.id })
      .from(employees)
      .where(and(eq(employees.id, employeeId), eq(employees.branchId, order.branchId), eq(employees.active, true)));
    if (!employee || !(await openShiftFor(employeeId, order.branchId))) return fail("That worker isn't on the clock.");
  }
  await db
    .update(orders)
    .set(
      employeeId === null
        ? { makerId: null, claimedAt: null, status: "placed" }
        : { makerId: employeeId, claimedAt: new Date(), status: "preparing" },
    )
    .where(eq(orders.id, orderId));
  await logActivity({
    ...access.viewer,
    action: employeeId === null ? "order.unassigned" : "order.assigned",
    targetType: "order",
    targetId: orderId,
    details: { from: order.makerId, to: employeeId },
  });
  refresh(order.branchId);
  return { ok: true, message: employeeId === null ? `Order #${orderId} is unassigned.` : `Order #${orderId} reassigned.` };
}

/** Orders each worker aims for per shift. A goal on everyone's board, not a cap. */
export async function setShiftTarget(branchId: number, _: FormState, data: FormData): Promise<FormState> {
  const access = await authorizeBranch(branchId);
  if (!access) return fail("You don't have access to this branch.");
  const raw = String(data.get("target") ?? "").trim();
  const parsed = z.coerce.number().int().min(1).max(500).safeParse(raw);
  if (raw && !parsed.success) return fail("Enter a whole number from 1 to 500, or leave it empty for no target.");
  const target = raw ? parsed.data! : null;
  await db.update(branches).set({ shiftOrderTarget: target }).where(eq(branches.id, branchId));
  await logActivity({ ...access.viewer, action: "branch.shift_target", targetType: "branch", targetId: branchId, details: { target } });
  refresh(branchId);
  return { ok: true, message: target ? `Target set: ${target} orders per shift.` : "Shift target removed." };
}

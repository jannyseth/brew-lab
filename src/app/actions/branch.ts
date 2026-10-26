"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { branches, employees, managerApplications, orders, payrollEntries } from "@/db/schema";
import type { FormState } from "@/components/action-form";
import { logActivity } from "@/lib/audit";
import { authorizeBranch } from "@/lib/branch-access";
import { emailPayslip } from "@/lib/payslips";
import { getSession } from "@/lib/session";

const fail = (message: string): FormState => ({ ok: false, message });
const notAllowed = fail("You don't have access to this branch.");

export async function applyAsManager(_: FormState, data: FormData): Promise<FormState> {
  const session = await getSession();
  if (!session) return fail("Please sign in first.");
  if (session.user.role !== "branch_applicant") return fail("Only branch owner accounts can apply.");

  const parsed = z
    .object({
      fullName: z.string().trim().min(2).max(80),
      phone: z.string().trim().min(5).max(30),
      message: z.string().trim().max(500),
    })
    .safeParse(Object.fromEntries(data));
  if (!parsed.success) return fail("Please enter your full name and a phone number.");

  const [existing] = await db
    .select({ status: managerApplications.status })
    .from(managerApplications)
    .where(eq(managerApplications.userId, session.user.id));
  if (existing?.status === "pending") return fail("Your application is already waiting for review.");

  // A rejected applicant may apply again; the old application is replaced.
  const [application] = await db
    .insert(managerApplications)
    .values({ userId: session.user.id, ...parsed.data })
    .onConflictDoUpdate({
      target: managerApplications.userId,
      set: { ...parsed.data, status: "pending", reviewNote: null, reviewedAt: null, createdAt: new Date() },
    })
    .returning({ id: managerApplications.id });
  await logActivity({
    userId: session.user.id,
    userEmail: session.user.email,
    action: "owner.applied",
    targetType: "application",
    targetId: application.id,
  });
  revalidatePath("/branch", "layout");
  return { ok: true, message: "Application sent. The admin will review it." };
}

export async function createBranch(_: FormState, data: FormData): Promise<FormState> {
  const session = await getSession();
  if (session?.user.role !== "branch_manager") return fail("Only verified branch owners can add branches.");

  const parsed = z
    .object({
      name: z.string().trim().min(2).max(80),
      address: z.string().trim().min(5).max(200),
      hours: z.string().trim().min(3).max(100),
    })
    .safeParse(Object.fromEntries(data));
  if (!parsed.success) return fail("Please fill in the branch name, address and opening hours.");

  const [branch] = await db
    .insert(branches)
    .values({ ...parsed.data, managerId: session.user.id })
    .returning({ id: branches.id });
  await logActivity({
    userId: session.user.id,
    userEmail: session.user.email,
    action: "branch.created",
    targetType: "branch",
    targetId: branch.id,
    details: { name: parsed.data.name },
  });
  revalidatePath("/branch", "layout");
  return { ok: true, message: "Branch submitted. Customers will see it once the admin approves it." };
}

// Orders move forward one step at a time; cancelling is allowed until completion.
const nextStatus = { placed: "preparing", preparing: "ready", ready: "completed" } as const;

async function authorizeOrder(orderId: number) {
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId));
  if (!order) return null;
  const access = await authorizeBranch(order.branchId);
  return access ? { order, viewer: access.viewer } : null;
}

export async function advanceOrder(orderId: number): Promise<FormState> {
  const access = await authorizeOrder(orderId);
  if (!access) return notAllowed;
  const { order, viewer } = access;
  if (!(order.status in nextStatus)) return fail("This order is already finished.");
  const next = nextStatus[order.status as keyof typeof nextStatus];
  if (next === "completed" && !order.paidAt) return fail("Mark the order as paid before completing it.");

  // The status condition stops two staff members from advancing the same order twice.
  const updated = await db
    .update(orders)
    .set({ status: next })
    .where(and(eq(orders.id, orderId), eq(orders.status, order.status)))
    .returning({ id: orders.id });
  revalidatePath(`/branch/${order.branchId}`, "layout");
  if (updated.length === 0) return fail("Someone else just updated this order. Refresh to see it.");
  await logActivity({ ...viewer, action: "order.status", targetType: "order", targetId: orderId, details: { from: order.status, to: next } });
  return { ok: true, message: `Order #${orderId} is now ${next}.` };
}

export async function cancelOrder(orderId: number): Promise<FormState> {
  const access = await authorizeOrder(orderId);
  if (!access) return notAllowed;
  const { order, viewer } = access;
  if (order.status === "completed" || order.status === "cancelled") return fail("This order is already finished.");
  await db.update(orders).set({ status: "cancelled", paidAt: null }).where(eq(orders.id, orderId));
  await logActivity({ ...viewer, action: "order.cancelled", targetType: "order", targetId: orderId, details: { by: "branch" } });
  revalidatePath(`/branch/${order.branchId}`, "layout");
  return { ok: true, message: `Order #${orderId} was cancelled.` };
}

export async function setOrderPaid(orderId: number, paid: boolean): Promise<FormState> {
  const access = await authorizeOrder(orderId);
  if (!access) return notAllowed;
  const { order, viewer } = access;
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
    details: { totalCents: order.totalCents },
  });
  revalidatePath(`/branch/${order.branchId}`, "layout");
  return { ok: true, message: paid ? "Marked as paid." : "Marked as unpaid." };
}

const money = z.coerce.number().min(0).max(10_000_000);

const PAYOUT_METHODS = ["Bank transfer", "GCash", "Maya", "Cash"] as const;

const employeeSchema = z
  .object({
    name: z.string().trim().min(2).max(80),
    position: z.string().trim().min(2).max(60),
    hourlyRate: money,
    email: z.union([z.literal(""), z.email().max(120)]),
    payoutMethod: z.union([z.literal(""), z.enum(PAYOUT_METHODS)]),
    payoutAccountName: z.string().trim().max(80),
    payoutAccountNumber: z.string().trim().max(40).regex(/^[0-9 -]*$/, "digits only"),
  })
  .transform((e) => ({
    name: e.name,
    position: e.position,
    hourlyRateCents: Math.round(e.hourlyRate * 100),
    email: e.email || null,
    payoutMethod: e.payoutMethod || null,
    payoutAccountName: e.payoutAccountName || null,
    payoutAccountNumber: e.payoutAccountNumber.replace(/[ -]/g, "") || null,
  }));

const employeeFields = (data: FormData) => ({
  name: data.get("name") ?? "",
  position: data.get("position") ?? "",
  hourlyRate: data.get("hourlyRate") ?? "",
  email: data.get("email") ?? "",
  payoutMethod: data.get("payoutMethod") ?? "",
  payoutAccountName: data.get("payoutAccountName") ?? "",
  payoutAccountNumber: data.get("payoutAccountNumber") ?? "",
});

export async function addEmployee(branchId: number, _: FormState, data: FormData): Promise<FormState> {
  const access = await authorizeBranch(branchId);
  if (!access) return notAllowed;
  const parsed = employeeSchema.safeParse(employeeFields(data));
  if (!parsed.success) return fail("Check the name, position, rate, email and account number (digits only).");

  const [employee] = await db
    .insert(employees)
    .values({ branchId, ...parsed.data })
    .returning({ id: employees.id });
  await logActivity({
    ...access.viewer,
    action: "employee.added",
    targetType: "employee",
    targetId: employee.id,
    details: { branchId, name: parsed.data.name },
  });
  revalidatePath(`/branch/${branchId}/payroll`);
  return { ok: true, message: `${parsed.data.name} added.` };
}

export async function updateEmployee(branchId: number, employeeId: number, _: FormState, data: FormData): Promise<FormState> {
  const access = await authorizeBranch(branchId);
  if (!access) return notAllowed;
  const parsed = employeeSchema.safeParse(employeeFields(data));
  if (!parsed.success) return fail("Check the name, position, rate, email and account number (digits only).");
  const updated = await db
    .update(employees)
    .set(parsed.data)
    .where(and(eq(employees.id, employeeId), eq(employees.branchId, branchId)))
    .returning({ id: employees.id });
  if (updated.length === 0) return fail("Employee not found.");
  await logActivity({ ...access.viewer, action: "employee.updated", targetType: "employee", targetId: employeeId, details: { branchId } });
  revalidatePath(`/branch/${branchId}/payroll`);
  return { ok: true, message: "Saved." };
}

/** The inbox that gets a copy of every payslip, e.g. the owner's accountant. */
export async function setRecordsEmail(branchId: number, _: FormState, data: FormData): Promise<FormState> {
  const access = await authorizeBranch(branchId);
  if (!access) return notAllowed;
  const parsed = z.union([z.literal(""), z.email().max(120)]).safeParse(String(data.get("recordsEmail") ?? "").trim());
  if (!parsed.success) return fail("Enter a valid email address, or leave it empty.");
  await db.update(branches).set({ recordsEmail: parsed.data || null }).where(eq(branches.id, branchId));
  await logActivity({ ...access.viewer, action: "branch.records_email", targetType: "branch", targetId: branchId });
  revalidatePath(`/branch/${branchId}/payroll`);
  return { ok: true, message: parsed.data ? "Payslip copies will go to this inbox." : "Records inbox removed." };
}

export async function setEmployeeActive(branchId: number, employeeId: number, active: boolean): Promise<FormState> {
  const access = await authorizeBranch(branchId);
  if (!access) return notAllowed;
  await db
    .update(employees)
    .set({ active })
    .where(and(eq(employees.id, employeeId), eq(employees.branchId, branchId)));
  await logActivity({
    ...access.viewer,
    action: active ? "employee.restored" : "employee.archived",
    targetType: "employee",
    targetId: employeeId,
    details: { branchId },
  });
  revalidatePath(`/branch/${branchId}/payroll`);
  return { ok: true, message: active ? "Employee reactivated." : "Employee archived." };
}

export async function logPayroll(branchId: number, _: FormState, data: FormData): Promise<FormState> {
  const access = await authorizeBranch(branchId);
  if (!access) return notAllowed;

  const parsed = z
    .object({
      employeeId: z.coerce.number().int().positive(),
      periodStart: z.iso.date(),
      periodEnd: z.iso.date(),
      hours: z.coerce.number().min(0).max(744),
      amount: money,
      note: z.string().trim().max(200),
    })
    .safeParse(Object.fromEntries(data));
  if (!parsed.success) return fail("Please fill in the employee, pay period, hours and amount.");
  const entry = parsed.data;
  if (entry.periodEnd < entry.periodStart) return fail("The period end can't be before its start.");

  // Make sure the employee belongs to this branch.
  const [employee] = await db
    .select({ id: employees.id })
    .from(employees)
    .where(and(eq(employees.id, entry.employeeId), eq(employees.branchId, branchId)));
  if (!employee) return fail("Choose an employee from this branch.");

  const amountCents = Math.round(entry.amount * 100);
  const [row] = await db
    .insert(payrollEntries)
    .values({
      branchId,
      employeeId: entry.employeeId,
      periodStart: entry.periodStart,
      periodEnd: entry.periodEnd,
      hours: entry.hours.toFixed(2),
      amountCents,
      note: entry.note,
      recordedBy: access.viewer.userId,
    })
    .returning({ id: payrollEntries.id });
  await logActivity({
    ...access.viewer,
    action: "payroll.logged",
    targetType: "payroll",
    targetId: row.id,
    details: { branchId, employeeId: entry.employeeId, amountCents },
  });
  // Email the payslip PDF to the employee and the records inbox once the response is sent.
  after(() => emailPayslip(row.id));
  revalidatePath(`/branch/${branchId}/payroll`);
  return { ok: true, message: "Payroll entry logged. The payslip is being emailed." };
}

export async function deletePayrollEntry(branchId: number, entryId: number): Promise<FormState> {
  const access = await authorizeBranch(branchId);
  if (!access) return notAllowed;
  const deleted = await db
    .delete(payrollEntries)
    .where(and(eq(payrollEntries.id, entryId), eq(payrollEntries.branchId, branchId)))
    .returning({ amountCents: payrollEntries.amountCents });
  if (deleted.length > 0) {
    await logActivity({
      ...access.viewer,
      action: "payroll.deleted",
      targetType: "payroll",
      targetId: entryId,
      details: { branchId, amountCents: deleted[0].amountCents },
    });
  }
  revalidatePath(`/branch/${branchId}/payroll`);
  return { ok: true, message: "Entry deleted." };
}

export async function resendPayslip(branchId: number, entryId: number): Promise<FormState> {
  const access = await authorizeBranch(branchId);
  if (!access) return notAllowed;
  const [entry] = await db
    .select({ id: payrollEntries.id })
    .from(payrollEntries)
    .where(and(eq(payrollEntries.id, entryId), eq(payrollEntries.branchId, branchId)));
  if (!entry) return fail("Entry not found.");
  const sentTo = await emailPayslip(entryId);
  if (sentTo.length === 0) return fail("Add the employee's email or a records inbox first.");
  await logActivity({ ...access.viewer, action: "payroll.payslip_sent", targetType: "payroll", targetId: entryId, details: { to: sentTo.length } });
  revalidatePath(`/branch/${branchId}/payroll`);
  return { ok: true, message: `Payslip sent to ${sentTo.join(", ")}.` };
}

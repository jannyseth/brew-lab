import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { branches, employees, payrollEntries } from "@/db/schema";
import { sendDocument } from "./mail";
import { payslipPdf, pdfMoney } from "./pdf";

/** Everything needed for one payslip, plus who may see it. */
export async function loadPayslip(entryId: number) {
  const [row] = await db
    .select({ entry: payrollEntries, employee: employees, branch: branches })
    .from(payrollEntries)
    .innerJoin(employees, eq(payrollEntries.employeeId, employees.id))
    .innerJoin(branches, eq(payrollEntries.branchId, branches.id))
    .where(eq(payrollEntries.id, entryId));
  return row ?? null;
}

export const payslipFilename = (row: NonNullable<Awaited<ReturnType<typeof loadPayslip>>>) =>
  `payslip-${row.employee.name.replace(/[^A-Za-z0-9]+/g, "-").toLowerCase()}-${row.entry.periodStart}.pdf`;

export async function renderPayslip(row: NonNullable<Awaited<ReturnType<typeof loadPayslip>>>) {
  return payslipPdf({
    entryId: row.entry.id,
    branch: { name: row.branch.name, address: row.branch.address },
    employee: row.employee,
    periodStart: row.entry.periodStart,
    periodEnd: row.entry.periodEnd,
    hours: row.entry.hours,
    hourlyRateCents: row.employee.hourlyRateCents,
    amountCents: row.entry.amountCents,
    note: row.entry.note,
    recordedAt: row.entry.createdAt,
  });
}

/**
 * Emails the payslip PDF to the employee and to the branch's records inbox.
 * Returns the addresses it was sent to (empty if none are set).
 */
export async function emailPayslip(entryId: number) {
  const row = await loadPayslip(entryId);
  if (!row) return [];
  const to = [row.employee.email, row.branch.recordsEmail].filter((e): e is string => Boolean(e));
  if (to.length === 0) return [];
  const sent = await sendDocument({
    to,
    subject: `Payslip ${row.entry.periodStart} to ${row.entry.periodEnd} - ${row.employee.name} (${row.branch.name})`,
    text: `Hi ${row.employee.name},\n\nAttached is your payslip from ${row.branch.name} for ${row.entry.periodStart} to ${row.entry.periodEnd}: ${pdfMoney(row.entry.amountCents)} for ${Number(row.entry.hours).toFixed(2)} hours.\n\nThis email is for your records. Questions about your pay? Please contact your branch owner.\n\nBrew Lab`,
    filename: payslipFilename(row),
    pdf: await renderPayslip(row),
  });
  if (!sent) return [];
  await db.update(payrollEntries).set({ payslipEmailedAt: new Date() }).where(eq(payrollEntries.id, entryId));
  return to;
}

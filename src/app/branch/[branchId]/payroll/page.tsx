import type { Metadata } from "next";
import { asc, desc, eq, sql } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { employees, payrollEntries } from "@/db/schema";
import { addEmployee } from "@/app/actions/branch";
import { ActionForm } from "@/components/action-form";
import { cardClass, inputClass } from "@/components/ui";
import { getManagedBranch } from "@/lib/branch-access";
import { formatCents } from "@/lib/drink";
import { requireUser } from "@/lib/session";
import { BranchHeader } from "../branch-header";
import { EmployeeToggle, DeleteEntryButton } from "./payroll-buttons";
import { PayrollForm } from "./payroll-form";

export const metadata: Metadata = { title: "Payroll" };

export default async function PayrollPage({ params }: PageProps<"/branch/[branchId]/payroll">) {
  const { branchId } = await params;
  const user = await requireUser(`/branch/${branchId}/payroll`);
  const branch = await getManagedBranch(Number(branchId), user);
  if (!branch) notFound();

  const staff = await db
    .select()
    .from(employees)
    .where(eq(employees.branchId, branch.id))
    .orderBy(desc(employees.active), asc(employees.name));

  const entries = await db
    .select({ entry: payrollEntries, employeeName: employees.name })
    .from(payrollEntries)
    .innerJoin(employees, eq(payrollEntries.employeeId, employees.id))
    .where(eq(payrollEntries.branchId, branch.id))
    .orderBy(desc(payrollEntries.periodStart), desc(payrollEntries.createdAt))
    .limit(100);

  const monthly = await db
    .select({
      month: sql<string>`to_char(${payrollEntries.periodStart}, 'YYYY-MM')`.as("month"),
      hours: sql<string>`sum(${payrollEntries.hours})`,
      amount: sql<number>`sum(${payrollEntries.amountCents})::int`,
    })
    .from(payrollEntries)
    .where(eq(payrollEntries.branchId, branch.id))
    .groupBy(sql`1`)
    .orderBy(desc(sql`1`))
    .limit(6);

  const addEmployeeToBranch = addEmployee.bind(null, branch.id);
  const active = staff.filter((s) => s.active);

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <BranchHeader branch={branch} active="Payroll" />
      <p className="mb-8 rounded-xl bg-accent-soft px-4 py-3 text-sm">
        This is a record-keeping log only. Pay your staff through your usual bank or payroll provider; Brew Lab never moves money.
      </p>

      <div className="grid gap-8 md:grid-cols-2">
        <section>
          <h2 className="mb-3 text-lg font-semibold">Log a pay period</h2>
          {active.length === 0 ? (
            <p className={cardClass}>Add an employee first.</p>
          ) : (
            <PayrollForm
              branchId={branch.id}
              employees={active.map((e) => ({ id: e.id, name: e.name, hourlyRateCents: e.hourlyRateCents }))}
            />
          )}
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold">Staff</h2>
          {staff.length > 0 && (
            <ul className="mb-4 divide-y divide-line rounded-2xl border border-line bg-card text-sm">
              {staff.map((s) => (
                <li key={s.id} className={`flex items-center justify-between gap-3 px-4 py-2 ${s.active ? "" : "opacity-50"}`}>
                  <span>
                    <span className="font-medium">{s.name}</span> · {s.position} · {formatCents(s.hourlyRateCents)}/hr
                  </span>
                  <EmployeeToggle branchId={branch.id} employeeId={s.id} active={s.active} />
                </li>
              ))}
            </ul>
          )}
          <ActionForm action={addEmployeeToBranch} submitLabel="Add employee" className={`${cardClass} space-y-3`}>
            <label className="block text-sm font-medium">
              Name
              <input name="name" required minLength={2} maxLength={80} className={inputClass} />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm font-medium">
                Position
                <input name="position" required minLength={2} maxLength={60} placeholder="Barista" className={inputClass} />
              </label>
              <label className="block text-sm font-medium">
                Hourly rate (₱)
                <input name="hourlyRate" type="number" step="0.01" min="0" required className={inputClass} />
              </label>
            </div>
          </ActionForm>
        </section>
      </div>

      <section className="mt-10">
        <h2 className="mb-3 text-lg font-semibold">Monthly totals</h2>
        {monthly.length === 0 ? (
          <p className="text-muted">Nothing logged yet.</p>
        ) : (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
            {monthly.map((m) => (
              <div key={m.month} className={cardClass}>
                <p className="text-sm text-muted">{m.month}</p>
                <p className="mt-1 font-display text-2xl font-semibold tabular-nums">{formatCents(m.amount)}</p>
                <p className="text-xs text-muted">{Number(m.hours).toFixed(1)} hours</p>
              </div>
            ))}
          </div>
        )}
      </section>

      {entries.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 text-lg font-semibold">Log</h2>
          <div className="overflow-x-auto rounded-2xl border border-line bg-card">
            <table className="w-full text-sm">
              <thead className="text-left text-muted">
                <tr className="border-b border-line">
                  <th className="px-4 py-2 font-medium">Employee</th>
                  <th className="px-4 py-2 font-medium">Period</th>
                  <th className="px-4 py-2 text-right font-medium">Hours</th>
                  <th className="px-4 py-2 text-right font-medium">Amount</th>
                  <th className="px-4 py-2 font-medium">Note</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {entries.map(({ entry, employeeName }) => (
                  <tr key={entry.id} className="border-b border-line last:border-0">
                    <td className="px-4 py-2">{employeeName}</td>
                    <td className="whitespace-nowrap px-4 py-2">
                      {entry.periodStart} → {entry.periodEnd}
                    </td>
                    <td className="px-4 py-2 text-right">{Number(entry.hours).toFixed(2)}</td>
                    <td className="px-4 py-2 text-right">{formatCents(entry.amountCents)}</td>
                    <td className="px-4 py-2 text-muted">{entry.note}</td>
                    <td className="px-4 py-2 text-right">
                      <DeleteEntryButton branchId={branch.id} entryId={entry.id} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

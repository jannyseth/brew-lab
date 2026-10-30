import type { Metadata } from "next";
import { asc, desc, eq, sql } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { employees, payrollEntries, timeEntries } from "@/db/schema";
import { addEmployee, setRecordsEmail, updateEmployee } from "@/app/actions/branch";
import { saveTimeEntry } from "@/app/actions/lounge";
import { ActionForm } from "@/components/action-form";
import { cardClass, formatDate, formatDateTime, inputClass } from "@/components/ui";
import { getManagedBranch } from "@/lib/branch-access";
import { formatCents } from "@/lib/drink";
import { maskAccount } from "@/lib/pdf";
import { requireUser } from "@/lib/session";
import { LONG_SHIFT_HOURS, toLocalInput } from "@/lib/workers";
import { BranchHeader } from "../branch-header";
import { DeleteEntryButton, EmployeeToggle, ResendPayslipButton } from "./payroll-buttons";
import { PayrollForm } from "./payroll-form";

export const metadata: Metadata = { title: "Payroll" };

type EmployeeDefaults = Partial<typeof employees.$inferSelect>;

function EmployeeFields({ e }: { e?: EmployeeDefaults }) {
  return (
    <>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2">
        <label className="block text-sm font-medium">
          Name
          <input name="name" required minLength={2} maxLength={80} defaultValue={e?.name} className={inputClass} />
        </label>
        <label className="block text-sm font-medium">
          Position
          <input name="position" required minLength={2} maxLength={60} placeholder="Barista" defaultValue={e?.position} className={inputClass} />
        </label>
        <label className="block text-sm font-medium">
          Hourly rate (₱)
          <input
            name="hourlyRate"
            type="number"
            step="0.01"
            min="0"
            required
            defaultValue={e?.hourlyRateCents !== undefined ? (e.hourlyRateCents / 100).toFixed(2) : undefined}
            className={inputClass}
          />
        </label>
        <label className="block text-sm font-medium">
          Email for payslips <span className="font-normal text-muted">(optional)</span>
          <input name="email" type="email" maxLength={120} defaultValue={e?.email ?? ""} className={inputClass} />
        </label>
      </div>
      <fieldset className="mt-4">
        <legend className="text-sm font-semibold">Receiving account</legend>
        <p className="text-xs text-muted">Where you send this employee&apos;s pay. Printed on payslips with only the last 4 digits shown.</p>
        <div className="mt-2 grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-3">
          <label className="block text-sm font-medium">
            Method
            <select name="payoutMethod" defaultValue={e?.payoutMethod ?? ""} className={inputClass}>
              <option value="">Not set</option>
              <option>Bank transfer</option>
              <option>GCash</option>
              <option>Maya</option>
              <option>Cash</option>
            </select>
          </label>
          <label className="block text-sm font-medium">
            Account name
            <input name="payoutAccountName" maxLength={80} defaultValue={e?.payoutAccountName ?? ""} className={inputClass} />
          </label>
          <label className="block text-sm font-medium">
            Account / mobile no.
            <input
              name="payoutAccountNumber"
              inputMode="numeric"
              maxLength={40}
              pattern="[0-9 \-]*"
              defaultValue={e?.payoutAccountNumber ?? ""}
              className={inputClass}
            />
          </label>
        </div>
      </fieldset>
    </>
  );
}

/** Times and reason for adding or fixing a shift. Saving needs the owner's password. */
function ShiftFields({ entry, staff }: { entry?: { employeeId: number; clockIn: Date; clockOut: Date | null }; staff: { id: number; name: string }[] }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2">
      {entry ? (
        <input type="hidden" name="employeeId" value={entry.employeeId} />
      ) : (
        <label className="block text-sm font-medium sm:col-span-2">
          Employee
          <select name="employeeId" className={inputClass}>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="block text-sm font-medium">
        Clock in
        <input name="clockIn" type="datetime-local" required defaultValue={entry ? toLocalInput(entry.clockIn) : undefined} className={inputClass} />
      </label>
      <label className="block text-sm font-medium">
        Clock out
        <input
          name="clockOut"
          type="datetime-local"
          required
          defaultValue={entry?.clockOut ? toLocalInput(entry.clockOut) : undefined}
          className={inputClass}
        />
      </label>
      <label className="block text-sm font-medium">
        Reason
        <input name="note" required minLength={3} maxLength={200} placeholder="Forgot to clock out" className={inputClass} />
      </label>
      <label className="block text-sm font-medium">
        Your password
        <input name="password" type="password" required autoComplete="current-password" className={inputClass} />
      </label>
    </div>
  );
}

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
    .select({ entry: payrollEntries, employeeName: employees.name, employeeEmail: employees.email })
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

  const active = staff.filter((s) => s.active);

  const shifts = await db
    .select({ entry: timeEntries, employeeName: employees.name })
    .from(timeEntries)
    .innerJoin(employees, eq(timeEntries.employeeId, employees.id))
    .where(eq(timeEntries.branchId, branch.id))
    .orderBy(desc(timeEntries.clockIn))
    .limit(40);

  return (
    <div>
      <BranchHeader branch={branch} />
      <p className="mb-8 rounded-xl bg-accent-soft px-4 py-3 text-sm">
        A record-keeping log. Pay your staff through your usual bank or e-wallet; Brew Lab never moves money. Each entry creates a
        payslip PDF that is emailed to the employee and your records inbox.
      </p>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-8 xl:grid-cols-2">
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

          <h2 className="mb-3 mt-8 text-lg font-semibold">Records inbox</h2>
          <ActionForm action={setRecordsEmail.bind(null, branch.id)} submitLabel="Save inbox" className={cardClass}>
            <label className="block text-sm font-medium">
              Send a copy of every payslip to <span className="font-normal text-muted">(e.g. your accountant)</span>
              <input
                name="recordsEmail"
                type="email"
                maxLength={120}
                defaultValue={branch.recordsEmail ?? ""}
                placeholder="records@yourbusiness.ph"
                className={inputClass}
              />
            </label>
          </ActionForm>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold">Staff</h2>
          {staff.length > 0 && (
            <ul className="mb-4 divide-y divide-line rounded-2xl border border-line bg-card text-sm">
              {staff.map((s) => (
                <li key={s.id} className={`px-4 py-3 ${s.active ? "" : "opacity-60"}`}>
                  <details>
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                      <span>
                        <span className="font-medium">{s.name}</span> · {s.position} · {formatCents(s.hourlyRateCents)}/hr
                        <span className="block text-xs text-muted">
                          {s.payoutMethod
                            ? `${s.payoutMethod}${s.payoutAccountNumber ? ` ${maskAccount(s.payoutAccountNumber)}` : ""}`
                            : "No receiving account"}
                          {s.email ? ` · ${s.email}` : " · no email"}
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-3">
                        <span className="text-xs text-accent">Edit</span>
                        <EmployeeToggle branchId={branch.id} employeeId={s.id} active={s.active} />
                      </span>
                    </summary>
                    <ActionForm action={updateEmployee.bind(null, branch.id, s.id)} submitLabel="Save changes" className="mt-4">
                      <EmployeeFields e={s} />
                    </ActionForm>
                  </details>
                </li>
              ))}
            </ul>
          )}
          <details className={cardClass} open={staff.length === 0}>
            <summary className="cursor-pointer font-medium">Add an employee</summary>
            <ActionForm action={addEmployee.bind(null, branch.id)} submitLabel="Add employee" className="mt-4">
              <EmployeeFields />
            </ActionForm>
          </details>
        </section>
      </div>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">Time clock</h2>
        <p className="mb-3 text-sm text-muted">
          Shifts from the counter QR code. Payroll hours are added up from these. Fixing or adding a shift needs your password and is logged.
        </p>
        {shifts.length > 0 && (
          <ul className="mb-4 divide-y divide-line rounded-2xl border border-line bg-card text-sm">
            {shifts.map(({ entry, employeeName }) => {
              const end = entry.clockOut ?? new Date();
              const hours = (end.getTime() - entry.clockIn.getTime()) / 3_600_000;
              const suspicious = hours > LONG_SHIFT_HOURS;
              return (
                <li key={entry.id} className="px-4 py-3">
                  <details>
                    <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2">
                      <span>
                        <span className="font-medium">{employeeName}</span> · {formatDateTime(entry.clockIn)} →{" "}
                        {entry.clockOut ? formatDateTime(entry.clockOut) : "still on the clock"}
                        {entry.source === "manual" && <span className="block text-xs text-muted">Set by hand: {entry.editNote}</span>}
                        {suspicious && <span className="block text-xs font-medium text-red-600">Over {LONG_SHIFT_HOURS} hours. Forgot to clock out?</span>}
                      </span>
                      <span className="flex items-center gap-3">
                        <span className="tabular-nums text-muted">{entry.clockOut ? `${hours.toFixed(2)} h` : "open"}</span>
                        <span className="text-xs text-accent">🔒 Fix</span>
                      </span>
                    </summary>
                    <ActionForm action={saveTimeEntry.bind(null, branch.id, entry.id)} submitLabel="Save shift" className="mt-4">
                      <ShiftFields entry={entry} staff={active} />
                    </ActionForm>
                  </details>
                </li>
              );
            })}
          </ul>
        )}
        {active.length > 0 && (
          <details className={cardClass}>
            <summary className="cursor-pointer font-medium">🔒 Add a shift by hand</summary>
            <ActionForm action={saveTimeEntry.bind(null, branch.id, null)} submitLabel="Add shift" className="mt-4">
              <ShiftFields staff={active} />
            </ActionForm>
          </details>
        )}
      </section>

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
          <h2 className="mb-3 text-lg font-semibold">Log and payslips</h2>
          <div className="overflow-x-auto rounded-2xl border border-line bg-card">
            <table className="w-full text-sm">
              <thead className="text-left text-muted">
                <tr className="border-b border-line">
                  <th className="px-4 py-2 font-medium">Employee</th>
                  <th className="px-4 py-2 font-medium">Period</th>
                  <th className="px-4 py-2 text-right font-medium">Hours</th>
                  <th className="px-4 py-2 text-right font-medium">Amount</th>
                  <th className="px-4 py-2 font-medium">Payslip</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {entries.map(({ entry, employeeName }) => (
                  <tr key={entry.id} className="border-b border-line align-top last:border-0">
                    <td className="px-4 py-2">
                      {employeeName}
                      {entry.note && <span className="block text-xs text-muted">{entry.note}</span>}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2">
                      {entry.periodStart} → {entry.periodEnd}
                    </td>
                    <td className="px-4 py-2 text-right">{Number(entry.hours).toFixed(2)}</td>
                    <td className="px-4 py-2 text-right">{formatCents(entry.amountCents)}</td>
                    <td className="px-4 py-2">
                      <a href={`/api/payslips/${entry.id}`} download className="font-medium text-accent hover:underline">
                        PDF
                      </a>
                      <span className="block text-xs text-muted">
                        {entry.payslipEmailedAt ? `Emailed ${formatDate(entry.payslipEmailedAt)}` : "Not emailed"}
                      </span>
                      <ResendPayslipButton branchId={branch.id} entryId={entry.id} />
                    </td>
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

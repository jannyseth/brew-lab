"use client";

import { useEffect, useState } from "react";
import { logPayroll } from "@/app/actions/branch";
import { hoursForPeriod } from "@/app/actions/lounge";
import { ActionForm } from "@/components/action-form";
import { cardClass, inputClass } from "@/components/ui";

type Employee = { id: number; name: string; hourlyRateCents: number };
type Clocked = { hours: number; shifts: number; open: number };

/**
 * Logs a pay period. Hours come from the time clock; typing other hours needs
 * the owner's password (checked on the server) and is written to the activity log.
 */
export function PayrollForm({ branchId, employees }: { branchId: number; employees: Employee[] }) {
  const [employeeId, setEmployeeId] = useState(employees[0].id);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [clocked, setClocked] = useState<Clocked | null>(null);
  const [changing, setChanging] = useState(false);
  const [hours, setHours] = useState("");
  const [amount, setAmount] = useState("");
  const [amountEdited, setAmountEdited] = useState(false);

  // Look up the clocked hours whenever the person or the period changes.
  useEffect(() => {
    let current = true;
    if (start && end && end >= start) {
      hoursForPeriod(branchId, employeeId, start, end).then((result) => current && setClocked(result));
    }
    return () => {
      current = false;
    };
  }, [branchId, employeeId, start, end]);

  const periodReady = !!start && !!end && end >= start;
  const rate = employees.find((e) => e.id === employeeId)?.hourlyRateCents ?? 0;
  const usedHours = changing ? Number(hours || 0) : periodReady ? (clocked?.hours ?? 0) : 0;
  // Suggest hours × rate until the owner types their own amount.
  const suggested = periodReady ? ((usedHours * rate) / 100).toFixed(2) : "";

  return (
    <ActionForm action={logPayroll.bind(null, branchId)} submitLabel="Log entry" className={`${cardClass} space-y-3`}>
      <label className="block text-sm font-medium">
        Employee
        <select name="employeeId" value={employeeId} onChange={(e) => setEmployeeId(Number(e.target.value))} className={inputClass}>
          {employees.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm font-medium">
          Period start
          <input name="periodStart" type="date" required value={start} onChange={(e) => setStart(e.target.value)} className={inputClass} />
        </label>
        <label className="block text-sm font-medium">
          Period end
          <input name="periodEnd" type="date" required value={end} onChange={(e) => setEnd(e.target.value)} className={inputClass} />
        </label>
      </div>

      <div className="rounded-xl bg-background px-4 py-3 ring-1 ring-line">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-sm font-medium">Hours from the clock</span>
          <span className={`font-display text-2xl font-semibold tabular-nums ${changing ? "text-muted line-through" : ""}`}>
            {periodReady && clocked ? clocked.hours.toFixed(2) : "—"}
          </span>
        </div>
        <p className="text-xs text-muted">
          {!periodReady
            ? "Pick the pay period to add up the clock-ins."
            : clocked
              ? `${clocked.shifts} finished shift${clocked.shifts === 1 ? "" : "s"}${clocked.open ? ` · ${clocked.open} still open (not counted)` : ""}`
              : "Adding up…"}
        </p>
        {!changing ? (
          <button type="button" onClick={() => setChanging(true)} className="mt-2 text-xs font-medium text-accent hover:underline">
            🔒 Change hours by hand
          </button>
        ) : (
          <div className="mt-3 grid grid-cols-2 gap-3 border-t border-line pt-3">
            <label className="block text-sm font-medium">
              Hours to pay
              <input
                name="overrideHours"
                type="number"
                step="0.25"
                min="0"
                max="744"
                required
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                className={inputClass}
              />
            </label>
            <label className="block text-sm font-medium">
              Your password
              <input name="password" type="password" required autoComplete="current-password" className={inputClass} />
            </label>
            <p className="col-span-2 text-xs text-muted">
              Changes to clocked hours are saved in the activity log with your name.{" "}
              <button
                type="button"
                onClick={() => {
                  setChanging(false);
                  setHours("");
                }}
                className="font-medium text-accent hover:underline"
              >
                Use the clock instead
              </button>
            </p>
          </div>
        )}
      </div>

      <label className="block text-sm font-medium">
        Amount (₱)
        <input
          name="amount"
          type="number"
          step="0.01"
          min="0"
          required
          value={amountEdited ? amount : suggested}
          onChange={(e) => {
            setAmount(e.target.value);
            setAmountEdited(true);
          }}
          className={inputClass}
        />
      </label>
      <label className="block text-sm font-medium">
        Note <span className="font-normal text-muted">(optional)</span>
        <input name="note" maxLength={200} placeholder="Includes holiday overtime" className={inputClass} />
      </label>
    </ActionForm>
  );
}

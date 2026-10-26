"use client";

import { useState } from "react";
import { logPayroll } from "@/app/actions/branch";
import { ActionForm } from "@/components/action-form";
import { cardClass, inputClass } from "@/components/ui";

type Employee = { id: number; name: string; hourlyRateCents: number };

export function PayrollForm({ branchId, employees }: { branchId: number; employees: Employee[] }) {
  const [employeeId, setEmployeeId] = useState(employees[0].id);
  const [hours, setHours] = useState("");
  const [amount, setAmount] = useState("");
  const [amountEdited, setAmountEdited] = useState(false);

  const rate = employees.find((e) => e.id === employeeId)?.hourlyRateCents ?? 0;
  // Suggest hours × rate until the manager types their own amount.
  const suggested = hours ? ((Number(hours) * rate) / 100).toFixed(2) : "";

  return (
    <ActionForm action={logPayroll.bind(null, branchId)} submitLabel="Log entry" className={`${cardClass} space-y-3`}>
      <label className="block text-sm font-medium">
        Employee
        <select
          name="employeeId"
          value={employeeId}
          onChange={(e) => setEmployeeId(Number(e.target.value))}
          className={inputClass}
        >
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
          <input name="periodStart" type="date" required className={inputClass} />
        </label>
        <label className="block text-sm font-medium">
          Period end
          <input name="periodEnd" type="date" required className={inputClass} />
        </label>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm font-medium">
          Hours
          <input
            name="hours"
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
      </div>
      <label className="block text-sm font-medium">
        Note <span className="font-normal text-muted">(optional)</span>
        <input name="note" maxLength={200} placeholder="Includes holiday overtime" className={inputClass} />
      </label>
    </ActionForm>
  );
}

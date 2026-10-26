"use client";

import { useState, useTransition } from "react";
import { deletePayrollEntry, resendPayslip, setEmployeeActive } from "@/app/actions/branch";

export function EmployeeToggle({ branchId, employeeId, active }: { branchId: number; employeeId: number; active: boolean }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(async () => void (await setEmployeeActive(branchId, employeeId, !active)))}
      className="text-xs text-muted hover:text-accent"
    >
      {active ? "Archive" : "Restore"}
    </button>
  );
}

export function DeleteEntryButton({ branchId, entryId }: { branchId: number; entryId: number }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        confirm("Delete this payroll entry?") &&
        startTransition(async () => void (await deletePayrollEntry(branchId, entryId)))
      }
      className="text-xs text-muted hover:text-red-600"
    >
      Delete
    </button>
  );
}

export function ResendPayslipButton({ branchId, entryId }: { branchId: number; entryId: number }) {
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  return (
    <span className="block">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await resendPayslip(branchId, entryId);
            setMessage(result?.message ?? "");
          })
        }
        className="text-xs text-muted hover:text-accent"
      >
        {pending ? "Sending…" : "Email again"}
      </button>
      {message && <span className="block max-w-48 text-xs text-muted">{message}</span>}
    </span>
  );
}

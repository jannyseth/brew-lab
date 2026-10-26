"use client";

import { useTransition } from "react";
import { deletePayrollEntry, setEmployeeActive } from "@/app/actions/branch";

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

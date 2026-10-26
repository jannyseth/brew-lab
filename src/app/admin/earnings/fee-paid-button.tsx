"use client";

import { useState, useTransition } from "react";
import { markFeePaid } from "@/app/actions/admin";

export function FeePaidButton({ branchId, month, paid }: { branchId: number; month: string; paid: boolean }) {
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  return (
    <span className="inline-flex flex-col items-end">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await markFeePaid(branchId, month, !paid);
            setError(result && !result.ok ? result.message : "");
          })
        }
        className={`whitespace-nowrap text-xs font-medium ${paid ? "text-muted hover:text-red-600" : "text-accent hover:underline"}`}
      >
        {pending ? "Saving…" : paid ? "Undo" : "Mark paid"}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </span>
  );
}

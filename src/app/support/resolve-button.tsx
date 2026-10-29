"use client";

import { useState, useTransition } from "react";
import { resolveOwnTicket } from "@/app/actions/support";
import { buttonSecondary } from "@/components/ui";

export function ResolveButton({ ticketId }: { ticketId: number }) {
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  return (
    <span className="inline-flex flex-col">
      <button
        type="button"
        disabled={pending}
        className={buttonSecondary}
        onClick={() =>
          startTransition(async () => {
            const result = await resolveOwnTicket(ticketId);
            setError(result && !result.ok ? result.message : "");
          })
        }
      >
        My question is answered
      </button>
      {error && <span className="mt-1 text-xs text-red-600">{error}</span>}
    </span>
  );
}

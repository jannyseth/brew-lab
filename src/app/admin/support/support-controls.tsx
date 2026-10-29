"use client";

import { useState, useTransition } from "react";
import { assignTicket, claimTicket, setTicketResolved } from "@/app/actions/support";
import type { FormState } from "@/components/action-form";
import { buttonPrimary, buttonSecondary, inputClass } from "@/components/ui";

function useAction() {
  const [message, setMessage] = useState<FormState>(null);
  const [pending, startTransition] = useTransition();
  const run = (action: () => Promise<FormState>) => startTransition(async () => setMessage(await action()));
  return { message, pending, run };
}

function Status({ state }: { state: FormState }) {
  if (!state) return null;
  return (
    <p role="status" className={`text-sm ${state.ok ? "text-emerald-700 dark:text-emerald-400" : "text-red-600"}`}>
      {state.message}
    </p>
  );
}

/** Claim, reassign and solve/reopen controls for one ticket. */
export function TicketControls({
  ticketId,
  assignedTo,
  meId,
  resolved,
  team,
}: {
  ticketId: number;
  assignedTo: string | null;
  meId: string;
  resolved: boolean;
  team: { id: string; name: string }[];
}) {
  const { message, pending, run } = useAction();
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {!assignedTo && (
          <button type="button" disabled={pending} className={buttonPrimary} onClick={() => run(() => claimTicket(ticketId))}>
            Take this ticket
          </button>
        )}
        <button type="button" disabled={pending} className={buttonSecondary} onClick={() => run(() => setTicketResolved(ticketId, !resolved))}>
          {resolved ? "Reopen" : "Mark solved"}
        </button>
      </div>
      <label className="block text-sm font-medium">
        Assigned to
        <select
          value={assignedTo ?? ""}
          disabled={pending}
          onChange={(e) => run(() => assignTicket(ticketId, e.target.value || null))}
          className={inputClass}
        >
          <option value="">Nobody (shared queue)</option>
          {team.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
              {p.id === meId ? " (you)" : ""}
            </option>
          ))}
        </select>
      </label>
      <Status state={message} />
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { assignOrder, claimOrder, releaseOrder, workerAdvance, workerSetPaid } from "@/app/actions/orders";
import type { FormState } from "./action-form";
import { buttonPrimary, buttonSecondary } from "./ui";

function useOrderAction() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const run = (action: () => Promise<FormState>) =>
    startTransition(async () => {
      const result = await action();
      setError(result && !result.ok ? result.message : "");
      router.refresh();
    });
  return { error, pending, run };
}

/**
 * A worker's buttons for one order. "Dibs" on anything up for grabs; the maker
 * marks it ready or gives it back; anyone on shift takes payment and hands it over.
 */
export function WorkerOrderButtons({
  orderId,
  status,
  paid,
  mine,
  upForGrabs,
}: {
  orderId: number;
  status: string;
  paid: boolean;
  mine: boolean;
  upForGrabs: boolean;
}) {
  const { error, pending, run } = useOrderAction();
  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex flex-wrap justify-end gap-2">
        {upForGrabs && (
          <button type="button" disabled={pending} className={`${buttonPrimary} px-6`} onClick={() => run(() => claimOrder(orderId))}>
            {pending ? "…" : "🙋 Dibs!"}
          </button>
        )}
        {mine && status === "preparing" && (
          <>
            <button type="button" disabled={pending} className="px-2 text-sm text-muted hover:text-foreground" onClick={() => run(() => releaseOrder(orderId))}>
              Give back
            </button>
            <button type="button" disabled={pending} className={buttonPrimary} onClick={() => run(() => workerAdvance(orderId))}>
              Mark ready
            </button>
          </>
        )}
        {status === "ready" && (
          <>
            <button type="button" disabled={pending} className={buttonSecondary} onClick={() => run(() => workerSetPaid(orderId, !paid))}>
              {paid ? "Undo paid" : "Mark paid"}
            </button>
            <button
              type="button"
              disabled={pending || !paid}
              title={paid ? undefined : "Mark the order as paid first"}
              className={buttonPrimary}
              onClick={() => run(() => workerAdvance(orderId))}
            >
              Hand over
            </button>
          </>
        )}
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}

/** The owner's "give this to…" picker for an order that isn't ready yet. */
export function AssignOrder({
  orderId,
  makerId,
  team,
}: {
  orderId: number;
  makerId: number | null;
  team: { employeeId: number; name: string }[];
}) {
  const { error, pending, run } = useOrderAction();
  return (
    <div className="flex flex-col items-end gap-1.5">
      <label className="flex items-center gap-2 text-sm">
        <span className="text-muted">Made by</span>
        <select
          disabled={pending}
          value={makerId ?? ""}
          onChange={(e) => run(() => assignOrder(orderId, e.target.value ? Number(e.target.value) : null))}
          className="rounded-full border border-line bg-card px-3 py-1.5 text-sm"
        >
          <option value="">{makerId ? "No one: back to the queue" : "No one yet"}</option>
          {team.map((p) => (
            <option key={p.employeeId} value={p.employeeId}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}

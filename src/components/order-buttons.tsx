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
 * A worker's buttons for one order: Pick up (dibs) → Order done → Payment
 * received → Mark as done. The maker finishes or gives back their order; anyone
 * on shift takes payment and closes it. Off the clock the buttons stay visible
 * but greyed out, so it's clear what clocking in unlocks.
 */
export function WorkerOrderButtons({
  orderId,
  status,
  paid,
  mine,
  upForGrabs,
  onShift,
}: {
  orderId: number;
  status: string;
  paid: boolean;
  mine: boolean;
  upForGrabs: boolean;
  onShift: boolean;
}) {
  const { error, pending, run } = useOrderAction();
  const disabled = pending || !onShift;
  const offClock = onShift ? undefined : "Clock in at the counter first";
  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex flex-wrap justify-end gap-2">
        {mine && status === "preparing" && (
          <button type="button" disabled={disabled} className="px-2 text-sm text-muted hover:text-foreground" onClick={() => run(() => releaseOrder(orderId))}>
            Give back
          </button>
        )}
        {status !== "completed" && status !== "cancelled" && (upForGrabs || mine || status === "ready") && (
          <button
            type="button"
            disabled={disabled}
            title={offClock}
            className={paid ? "px-2 text-sm text-muted hover:text-foreground" : buttonSecondary}
            onClick={() => run(() => workerSetPaid(orderId, !paid))}
          >
            {paid ? "Undo payment" : "💵 Payment received"}
          </button>
        )}
        {upForGrabs && (
          <button type="button" disabled={disabled} title={offClock} className={`${buttonPrimary} px-6`} onClick={() => run(() => claimOrder(orderId))}>
            {pending ? "…" : "🙋 Pick up"}
          </button>
        )}
        {mine && status === "preparing" && (
          <button type="button" disabled={disabled} title={offClock} className={buttonPrimary} onClick={() => run(() => workerAdvance(orderId))}>
            ☕ Order done
          </button>
        )}
        {status === "ready" && (
          <button
            type="button"
            disabled={disabled || !paid}
            title={offClock ?? (paid ? undefined : "Tap Payment received first")}
            className={buttonPrimary}
            onClick={() => run(() => workerAdvance(orderId))}
          >
            ✅ Mark as done
          </button>
        )}
      </div>
      {!onShift && <p className="text-xs text-muted">Clock in to use these.</p>}
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

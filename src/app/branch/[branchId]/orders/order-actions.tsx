"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { advanceOrder, cancelOrder, setOrderPaid } from "@/app/actions/branch";
import type { FormState } from "@/components/action-form";
import { buttonPrimary, buttonSecondary } from "@/components/ui";

const advanceLabels: Record<string, string> = {
  placed: "Start preparing",
  preparing: "Mark ready",
  ready: "Complete pickup",
};

export function OrderActions({ orderId, status, paid }: { orderId: number; status: string; paid: boolean }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const finished = status === "completed" || status === "cancelled";
  if (finished) return null;

  const run = (action: () => Promise<FormState>) =>
    startTransition(async () => {
      const result = await action();
      setError(result && !result.ok ? result.message : "");
      router.refresh();
    });

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" disabled={pending} className={buttonSecondary} onClick={() => run(() => setOrderPaid(orderId, !paid))}>
          {paid ? "Undo paid" : "Mark paid"}
        </button>
        <button
          type="button"
          disabled={pending || (status === "ready" && !paid)}
          title={status === "ready" && !paid ? "Mark the order as paid first" : undefined}
          className={buttonPrimary}
          onClick={() => run(() => advanceOrder(orderId))}
        >
          {advanceLabels[status]}
        </button>
        <button
          type="button"
          disabled={pending}
          className="px-2 text-sm text-muted hover:text-red-600"
          onClick={() => confirm(`Cancel order #${orderId}?`) && run(() => cancelOrder(orderId))}
        >
          Cancel
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}

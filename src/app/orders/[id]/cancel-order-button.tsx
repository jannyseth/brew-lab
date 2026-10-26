"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { cancelOwnOrder } from "@/app/actions/customer";
import { buttonSecondary } from "@/components/ui";

export function CancelOrderButton({ orderId }: { orderId: number }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <div className="mt-8">
      <button
        type="button"
        disabled={pending}
        className={buttonSecondary}
        onClick={() => {
          if (!confirm("Cancel this order?")) return;
          startTransition(async () => {
            const result = await cancelOwnOrder(orderId);
            if (!result.ok) setError(result.error);
            router.refresh();
          });
        }}
      >
        {pending ? "Cancelling…" : "Cancel order"}
      </button>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}

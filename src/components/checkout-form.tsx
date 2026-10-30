"use client";

import { useState, useTransition } from "react";
import { placeOrder, type CheckoutBranch } from "@/app/actions/customer";
import { useCart } from "@/components/cart";
import { buttonPrimary, inputClass } from "@/components/ui";
import { FREE_DRINK_COINS } from "@/lib/coin-rules";
import { formatCents } from "@/lib/drink";

/** The checkout step inside the cart drawer. */
export function CheckoutForm({
  branches,
  defaultName,
  coins,
  onPlaced,
}: {
  branches: CheckoutBranch[];
  defaultName: string;
  coins: number;
  onPlaced: (orderId: number) => void;
}) {
  const { lines, clear } = useCart();
  const [branchId, setBranchId] = useState(branches[0]?.id ?? 0);
  const [pickupName, setPickupName] = useState(defaultName);
  const [note, setNote] = useState("");
  const [useCoins, setUseCoins] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  if (branches.length === 0) return <p className="text-sm">No branches are taking orders yet. Please check back soon.</p>;

  const subtotal = lines.reduce((sum, l) => sum + l.unitPriceCents * l.quantity, 0);
  const canUseCoins = coins >= FREE_DRINK_COINS;
  const discount = useCoins && canUseCoins ? Math.max(...lines.map((l) => l.unitPriceCents)) : 0;
  const total = subtotal - discount;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setError("");
        startTransition(async () => {
          const result = await placeOrder({
            branchId,
            pickupName,
            note,
            items: lines.map((l) => ({ slug: l.slug, selection: l.selection, quantity: l.quantity, signature: l.signature })),
            useCoins: discount > 0,
          });
          if (result.ok) {
            clear();
            onPlaced(result.orderId);
          } else {
            setError(result.error);
          }
        });
      }}
      className="flex flex-1 flex-col"
    >
      <div className="flex-1 space-y-5">
        <fieldset>
          <legend className="mb-2 text-sm font-semibold">Pick up at</legend>
          <div className="space-y-2">
            {branches.map((b) => (
              <label
                key={b.id}
                className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 ${
                  branchId === b.id ? "border-accent bg-accent-soft" : "border-line hover:border-accent"
                }`}
              >
                <input type="radio" name="branch" className="sr-only" checked={branchId === b.id} onChange={() => setBranchId(b.id)} />
                {b.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={b.imageUrl} alt="" className="h-12 w-16 shrink-0 rounded-lg object-cover" />
                )}
                <span className="min-w-0 text-sm">
                  <span className="block font-medium">{b.name}</span>
                  <span className="block truncate text-muted">{b.hours}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <label className="block text-sm font-medium">
          Name for pickup
          <input value={pickupName} onChange={(e) => setPickupName(e.target.value)} maxLength={40} required className={inputClass} />
        </label>
        <label className="block text-sm font-medium">
          Note for the barista <span className="font-normal text-muted">(optional)</span>
          <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} className={inputClass} />
        </label>

        <label className={`flex items-center gap-3 rounded-xl border border-line p-3 text-sm ${canUseCoins ? "cursor-pointer" : "opacity-60"}`}>
          <input
            type="checkbox"
            checked={useCoins && canUseCoins}
            disabled={!canUseCoins}
            onChange={(e) => setUseCoins(e.target.checked)}
            className="h-4 w-4 accent-[var(--accent)]"
          />
          <span>
            <span className="font-medium">Free drink for {FREE_DRINK_COINS} coins</span>
            <span className="block text-muted">
              {canUseCoins ? `You have ${coins} coins.` : `${FREE_DRINK_COINS - coins} more coins needed.`}
            </span>
          </span>
        </label>
      </div>

      <div className="mt-6 border-t border-line pt-4">
        <div className="flex items-baseline justify-between">
          <span className="text-muted">{discount > 0 ? `Free drink −${formatCents(discount)}` : "Pay at pickup"}</span>
          <span className="font-display text-2xl font-semibold tabular-nums">{formatCents(total)}</span>
        </div>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        <button disabled={pending} className={`${buttonPrimary} mt-3 w-full py-3`}>
          {pending ? "Placing order…" : "Place order"}
        </button>
      </div>
    </form>
  );
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { placeOrder } from "@/app/actions/customer";
import { useCart } from "@/components/cart";
import { buttonPrimary, cardClass, inputClass } from "@/components/ui";
import { FREE_DRINK_COINS } from "@/lib/coin-rules";
import { formatCents } from "@/lib/drink";

type Branch = { id: number; name: string; address: string; hours: string; imageUrl: string | null };

export function CheckoutForm({ branches, defaultName, coins }: { branches: Branch[]; defaultName: string; coins: number }) {
  const router = useRouter();
  const { lines, clear } = useCart();
  const [branchId, setBranchId] = useState(branches[0]?.id ?? 0);
  const [pickupName, setPickupName] = useState(defaultName);
  const [note, setNote] = useState("");
  const [useCoins, setUseCoins] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  if (branches.length === 0) {
    return <div className={cardClass}>No branches are taking orders yet. Please check back soon.</div>;
  }
  if (lines.length === 0) {
    return (
      <div className={cardClass}>
        Your cart is empty.{" "}
        <Link href="/menu" className="font-medium text-accent">
          Browse the menu →
        </Link>
      </div>
    );
  }

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
            router.push(`/orders/${result.orderId}`);
          } else {
            setError(result.error);
          }
        });
      }}
      className="space-y-6"
    >
      <fieldset>
        <legend className="mb-3 font-semibold">Pickup branch</legend>
        <div className="space-y-2">
          {branches.map((b) => (
            <label
              key={b.id}
              className={`block cursor-pointer rounded-2xl border p-4 ${
                branchId === b.id ? "border-accent bg-accent-soft" : "border-line bg-card hover:border-accent"
              }`}
            >
              <input
                type="radio"
                name="branch"
                className="sr-only"
                checked={branchId === b.id}
                onChange={() => setBranchId(b.id)}
              />
              <span className="flex items-center gap-4">
                {b.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={b.imageUrl} alt="" className="aspect-[1200/630] w-24 shrink-0 rounded-lg object-cover" />
                )}
                <span>
                  <span className="font-medium">{b.name}</span>
                  <span className="block text-sm text-muted">
                    {b.address} · {b.hours}
                  </span>
                </span>
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
        <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} rows={2} className={inputClass} />
      </label>

      <label
        className={`flex items-start gap-3 rounded-2xl border p-4 ${canUseCoins ? "cursor-pointer border-line bg-card" : "border-line opacity-70"}`}
      >
        <input
          type="checkbox"
          checked={useCoins && canUseCoins}
          disabled={!canUseCoins}
          onChange={(e) => setUseCoins(e.target.checked)}
          className="mt-1 h-4 w-4 accent-[var(--accent)]"
        />
        <span className="text-sm">
          <span className="font-medium">Use {FREE_DRINK_COINS} bean coins for a free drink</span>
          <span className="block text-muted">
            {canUseCoins
              ? `You have ${coins} coins. The most expensive drink in this order becomes free.`
              : `You have ${coins} spendable coins. Earn ${FREE_DRINK_COINS - coins} more to get a free drink.`}{" "}
            <Link href="/rewards" className="text-accent hover:underline">
              Rewards
            </Link>
          </span>
        </span>
      </label>

      <div className="flex items-center justify-between border-t border-line pt-6">
        <span className="text-lg">
          Total <span className="font-display text-2xl font-semibold tabular-nums">{formatCents(total)}</span>
          <span className="block text-sm text-muted">
            {discount > 0 ? `Free drink −${formatCents(discount)} · ` : ""}Pay at pickup
          </span>
        </span>
        <button disabled={pending} className={buttonPrimary}>
          {pending ? "Placing order…" : "Place order"}
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  );
}

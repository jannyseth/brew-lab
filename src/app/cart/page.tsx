"use client";

import Link from "next/link";
import { MAX_QUANTITY, useCart } from "@/components/cart";
import { buttonPrimary, cardClass, PageTitle } from "@/components/ui";
import { formatCents } from "@/lib/drink";

export default function CartPage() {
  const { lines, setQuantity } = useCart();
  const total = lines.reduce((sum, l) => sum + l.unitPriceCents * l.quantity, 0);

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <PageTitle title="Your order" subtitle="You'll pay at the counter when you pick it up." />
      {lines.length === 0 ? (
        <div className={cardClass}>
          <p>Your cart is empty.</p>
          <Link href="/menu" className="mt-3 inline-block font-medium text-accent">
            Browse the menu →
          </Link>
        </div>
      ) : (
        <>
          <ul className="divide-y divide-line rounded-2xl border border-line bg-card">
            {lines.map((line) => (
              <li key={line.id} className="flex flex-wrap items-center justify-between gap-4 p-4">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{line.drinkName}</p>
                  <p className="text-sm text-muted">{line.summary}</p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    aria-label={`Remove one ${line.drinkName}`}
                    onClick={() => setQuantity(line.id, line.quantity - 1)}
                    className="h-8 w-8 rounded-full border border-line hover:border-accent"
                  >
                    −
                  </button>
                  <span className="w-4 text-center tabular-nums">{line.quantity}</span>
                  <button
                    type="button"
                    aria-label={`Add one ${line.drinkName}`}
                    disabled={line.quantity >= MAX_QUANTITY}
                    onClick={() => setQuantity(line.id, line.quantity + 1)}
                    className="h-8 w-8 rounded-full border border-line hover:border-accent disabled:opacity-40"
                  >
                    +
                  </button>
                  <span className="w-16 text-right font-medium tabular-nums">
                    {formatCents(line.unitPriceCents * line.quantity)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-6 flex items-center justify-between">
            <span className="text-lg">
              Total <span className="font-display text-2xl font-semibold tabular-nums">{formatCents(total)}</span>
            </span>
            <Link href="/checkout" className={buttonPrimary}>
              Checkout
            </Link>
          </div>
        </>
      )}
    </div>
  );
}

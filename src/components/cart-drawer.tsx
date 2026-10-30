"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { getCheckoutInfo, type CheckoutBranch } from "@/app/actions/customer";
import { CheckoutForm } from "@/components/checkout-form";
import { MAX_QUANTITY, useCart } from "@/components/cart";
import { buttonPrimary } from "@/components/ui";
import { formatCents } from "@/lib/drink";

type Checkout =
  | { state: "loading" }
  | {
      state: "ready";
      branches: CheckoutBranch[];
      defaultName: string;
      coins: number;
    }
  | { state: "error"; message: string; signIn?: boolean };

/** The cart and checkout as one card that slides in over the page, like most online shops. */
export function CartDrawer() {
  const { lines, setQuantity, isOpen, close } = useCart();
  const router = useRouter();
  const pathname = usePathname();
  const dialog = useRef<HTMLDialogElement>(null);
  const [step, setStep] = useState<"cart" | "checkout">("cart");
  const [checkout, setCheckout] = useState<Checkout>({ state: "loading" });

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (isOpen && !d.open) d.showModal();
    if (!isOpen && d.open) d.close();
  }, [isOpen]);

  // Close when the page changes underneath (e.g. after following a link inside).
  useEffect(() => close(), [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  const count = lines.reduce((n, l) => n + l.quantity, 0);
  const total = lines.reduce((sum, l) => sum + l.unitPriceCents * l.quantity, 0);

  async function goToCheckout() {
    setStep("checkout");
    setCheckout({ state: "loading" });
    const result = await getCheckoutInfo();
    setCheckout(result.ok ? { state: "ready", ...result } : { state: "error", message: result.error, signIn: result.signIn });
  }

  function onClosed() {
    close();
    setStep("cart");
  }

  return (
    <dialog
      ref={dialog}
      onClose={onClosed}
      onClick={(e) => e.target === dialog.current && dialog.current?.close()}
      aria-label={step === "cart" ? "Your order" : "Checkout"}
      className="fixed inset-y-0 right-0 left-auto m-0 h-dvh max-h-dvh w-full max-w-md bg-transparent p-0 text-foreground backdrop:bg-black/40 print:hidden"
    >
      {/* Drawn only while open: the cart lives in this browser, so the server never knows its contents. */}
      {isOpen && (
        <div className="flex h-full flex-col bg-background shadow-2xl sm:rounded-l-3xl">
          <header className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
            {step === "checkout" ? (
              <button type="button" onClick={() => setStep("cart")} className="text-sm font-medium text-muted hover:text-accent">
                ← Back
              </button>
            ) : (
              <h2 className="font-display text-xl font-semibold">Your order{count > 0 && ` (${count})`}</h2>
            )}
            {step === "checkout" && <h2 className="font-display text-xl font-semibold">Checkout</h2>}
            <button
              type="button"
              onClick={() => dialog.current?.close()}
              aria-label="Close"
              className="flex h-9 w-9 items-center justify-center rounded-full text-xl hover:bg-accent-soft"
            >
              ×
            </button>
          </header>

          <div className="flex flex-1 flex-col overflow-y-auto px-5 py-4">
            {lines.length === 0 ? (
              <div className="my-auto text-center">
                <p className="text-4xl" aria-hidden>
                  ☕
                </p>
                <p className="mt-2 font-medium">Your cart is empty</p>
                <Link href="/menu" className={`${buttonPrimary} mt-4 inline-block`}>
                  Browse the menu
                </Link>
              </div>
            ) : step === "cart" ? (
              <>
                <ul className="flex-1 divide-y divide-line">
                  {lines.map((line) => (
                    <li key={line.id} className="py-3">
                      <div className="flex justify-between gap-3">
                        <p className="font-medium">{line.drinkName}</p>
                        <span className="tabular-nums">{formatCents(line.unitPriceCents * line.quantity)}</span>
                      </div>
                      <p className="line-clamp-2 text-xs text-muted">{line.summary}</p>
                      <div className="mt-2 flex items-center gap-2">
                        <button
                          type="button"
                          aria-label={`Remove one ${line.drinkName}`}
                          onClick={() => setQuantity(line.id, line.quantity - 1)}
                          className="h-8 w-8 rounded-full ring-1 ring-line hover:ring-accent"
                        >
                          {line.quantity === 1 ? "🗑" : "−"}
                        </button>
                        <span className="w-5 text-center text-sm tabular-nums">{line.quantity}</span>
                        <button
                          type="button"
                          aria-label={`Add one ${line.drinkName}`}
                          disabled={line.quantity >= MAX_QUANTITY}
                          onClick={() => setQuantity(line.id, line.quantity + 1)}
                          className="h-8 w-8 rounded-full ring-1 ring-line hover:ring-accent disabled:opacity-40"
                        >
                          +
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
                <div className="mt-4 border-t border-line pt-4">
                  <div className="flex items-baseline justify-between">
                    <span className="text-muted">Total · pay at pickup</span>
                    <span className="font-display text-2xl font-semibold tabular-nums">{formatCents(total)}</span>
                  </div>
                  <button type="button" onClick={goToCheckout} className={`${buttonPrimary} mt-3 w-full py-3`}>
                    Checkout
                  </button>
                </div>
              </>
            ) : checkout.state === "loading" ? (
              <p className="my-auto text-center text-muted">Loading…</p>
            ) : checkout.state === "error" ? (
              <div className="my-auto text-center">
                <p>{checkout.message}</p>
                {checkout.signIn && (
                  <div className="mt-4 flex justify-center gap-3">
                    <Link href={`/sign-in?next=${encodeURIComponent(pathname)}`} className={buttonPrimary}>
                      Sign in
                    </Link>
                    <Link href="/sign-up" className="rounded-full px-5 py-2.5 text-sm font-medium ring-1 ring-line">
                      Create account
                    </Link>
                  </div>
                )}
                {checkout.signIn && <p className="mt-3 text-xs text-muted">Your cart stays here while you sign in.</p>}
              </div>
            ) : (
              <CheckoutForm
                branches={checkout.branches}
                defaultName={checkout.defaultName}
                coins={checkout.coins}
                onPlaced={(orderId) => {
                  dialog.current?.close();
                  router.push(`/orders/${orderId}`);
                }}
              />
            )}
          </div>
        </div>
      )}
    </dialog>
  );
}

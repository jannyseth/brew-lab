"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { saveDrink } from "@/app/actions/customer";
import { MAX_QUANTITY, useCart } from "@/components/cart";
import {
  completeSelection,
  describeSelection,
  formatCents,
  initialSelection,
  priceDrink,
  visibleGroups,
  type DrinkConfig,
  type DrinkGroup,
  type DrinkOption,
  type Selection,
} from "@/lib/drink";

// The order page for menu drinks: a photo and a plain form, like most coffee
// apps. (Build Your Own has its own game instead.)

export function DrinkForm({ drink }: { drink: DrinkConfig }) {
  const router = useRouter();
  const cart = useCart();
  const [selection, setSelection] = useState<Selection>(() => initialSelection(drink));
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);

  // Saved drinks open with their recipe in the URL hash (#s=...).
  useEffect(() => {
    const encoded = new URLSearchParams(window.location.hash.slice(1)).get("s");
    if (!encoded) return;
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reading the URL hash after hydration
      setSelection(completeSelection(drink, JSON.parse(encoded)));
    } catch {}
  }, [drink]);

  const update = (next: Selection) => {
    setSelection(completeSelection(drink, next));
    setAdded(false);
  };
  const has = (slug: string) => (selection[slug] ?? 0) > 0;
  const groups = visibleGroups(drink, selection);
  const price = priceDrink(drink, selection);
  const summary = describeSelection(drink, selection);

  const choose = (group: DrinkGroup, option: DrinkOption) => {
    const next = { ...selection };
    for (const o of group.options) delete next[o.slug];
    next[option.slug] = 1;
    update(next);
  };
  const setQty = (option: DrinkOption, qty: number) => {
    const next = { ...selection };
    if (qty <= 0) delete next[option.slug];
    else next[option.slug] = Math.min(qty, option.maxQuantity);
    update(next);
  };
  const add = () => {
    if (!price.ok) return;
    cart.add({ slug: drink.slug, drinkName: drink.name, summary: summary.join(" · "), selection, unitPriceCents: price.totalCents, quantity });
    setAdded(true);
  };

  return (
    <div className="mx-auto max-w-5xl pb-32 md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:gap-10 md:px-4 md:pt-8">
      {/* Photo */}
      <div className="relative md:sticky md:top-6 md:self-start">
        <div className="aspect-[4/3] overflow-hidden bg-accent-soft md:aspect-square md:rounded-3xl">
          {drink.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={drink.photoUrl} alt={drink.name} className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full items-center justify-center text-7xl" aria-hidden>
              ☕
            </span>
          )}
        </div>
        <Link
          href="/menu"
          aria-label="Back to menu"
          className="absolute left-3 top-3 flex h-10 w-10 items-center justify-center rounded-full bg-card/95 text-lg shadow-sm md:hidden"
        >
          ←
        </Link>
      </div>

      {/* Details and options */}
      <div className="px-4 pt-5 md:px-0 md:pt-0">
        <Link href="/menu" className="hidden text-sm text-muted hover:text-accent md:inline">
          ← Back to menu
        </Link>
        <div className="flex items-start justify-between gap-4 md:mt-3">
          <h1 className="font-display text-3xl font-semibold tracking-tight">{drink.name}</h1>
          <p className="shrink-0 pt-1 font-display text-xl font-semibold tabular-nums">{formatCents(drink.basePriceCents)}</p>
        </div>
        <p className="mt-2 text-muted">{drink.description}</p>

        <div className="mt-6 divide-y divide-line border-y border-line">
          {groups.map((group) => (
            <div key={group.slug} role="group" aria-labelledby={`group-${group.slug}`} className="py-5">
              <div className="mb-3 flex items-baseline justify-between">
                <h2 id={`group-${group.slug}`} className="font-semibold">
                  {group.name}
                </h2>
                <span className="rounded-full bg-background px-2 py-0.5 text-xs text-muted ring-1 ring-line">
                  {group.minSelected > 0
                    ? "Required"
                    : group.selection === "multi" && group.options.length > 1 && group.options.every((o) => o.maxQuantity === 1)
                      ? `Optional · up to ${group.maxSelected}`
                      : "Optional"}
                </span>
              </div>
              {group.selection === "single" ? (
                <div className="flex flex-wrap gap-2">
                  {group.options.map((option) => (
                    <button
                      key={option.slug}
                      type="button"
                      aria-pressed={has(option.slug)}
                      onClick={() => choose(group, option)}
                      className={`rounded-full px-4 py-2 text-sm transition ${
                        has(option.slug) ? "bg-foreground font-semibold text-background" : "bg-card ring-1 ring-line hover:ring-accent"
                      }`}
                    >
                      {option.name}
                      {option.priceDeltaCents > 0 && (
                        <span className={has(option.slug) ? "opacity-80" : "text-muted"}> +{formatCents(option.priceDeltaCents)}</span>
                      )}
                    </button>
                  ))}
                </div>
              ) : (
                <ul className="space-y-1">
                  {group.options.map((option) => (
                    <AddOnRow
                      key={option.slug}
                      option={option}
                      qty={selection[option.slug] ?? 0}
                      included={drink.defaults[option.slug] ?? 0}
                      blocked={!has(option.slug) && group.options.filter((o) => has(o.slug)).length >= group.maxSelected}
                      onChange={(q) => setQty(option, q)}
                    />
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
          <button type="button" onClick={() => update(initialSelection(drink))} className="text-muted hover:text-accent">
            Reset to the original recipe
          </button>
          <SaveRecipe slug={drink.slug} defaultName={`My ${drink.name}`} selection={selection} disabled={!price.ok} onSignIn={() => router.push(`/sign-in?next=${encodeURIComponent(`/menu/${drink.slug}`)}`)} />
        </div>
      </div>

      {/* Sticky order bar */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          {added ? (
            <>
              <p className="flex-1 text-sm font-semibold" role="status">
                ✓ Added to your order
              </p>
              <Link href="/menu" className="rounded-full px-4 py-3 text-sm font-medium ring-1 ring-line">
                Keep browsing
              </Link>
              <button type="button" onClick={cart.open} className="rounded-full bg-accent px-5 py-3 text-sm font-semibold text-accent-contrast">
                View cart
              </button>
            </>
          ) : (
            <>
              <span className="flex items-center gap-2" aria-label="Quantity">
                <button type="button" aria-label="One fewer" disabled={quantity <= 1} onClick={() => setQuantity(quantity - 1)} className="h-10 w-10 rounded-full text-lg ring-1 ring-line disabled:opacity-40">
                  −
                </button>
                <span className="w-5 text-center font-semibold tabular-nums">{quantity}</span>
                <button type="button" aria-label="One more" disabled={quantity >= MAX_QUANTITY} onClick={() => setQuantity(quantity + 1)} className="h-10 w-10 rounded-full text-lg ring-1 ring-line disabled:opacity-40">
                  +
                </button>
              </span>
              <button
                type="button"
                onClick={add}
                disabled={!price.ok}
                className="flex flex-1 items-center justify-between rounded-full bg-accent px-5 py-3 font-semibold text-accent-contrast shadow-sm transition hover:opacity-90 active:scale-[.98] disabled:opacity-50"
              >
                <span>Add to cart</span>
                <span className="tabular-nums">{price.ok ? formatCents(price.totalCents * quantity) : "—"}</span>
              </button>
            </>
          )}
        </div>
        {!price.ok && <p className="px-4 pb-2 text-center text-xs text-red-600">{price.errors[0]}</p>}
      </div>
    </div>
  );
}

function AddOnRow({
  option,
  qty,
  included,
  blocked,
  onChange,
}: {
  option: DrinkOption;
  qty: number;
  included: number;
  blocked: boolean;
  onChange: (qty: number) => void;
}) {
  const counter = option.maxQuantity > 1;
  const note =
    option.priceDeltaCents > 0
      ? `+${formatCents(option.priceDeltaCents)}${counter ? " each" : ""}${included ? ` · ${included} included` : ""}`
      : "Free";
  return (
    <li className={`flex items-center justify-between gap-3 py-1.5 ${blocked ? "opacity-50" : ""}`}>
      <span>
        <span className={qty ? "font-medium" : ""}>{option.name}</span>
        <span className="ml-2 text-xs text-muted">{note}</span>
      </span>
      {counter ? (
        <span className="flex items-center gap-2">
          <button type="button" aria-label={`Remove one ${option.name}`} disabled={qty === 0} onClick={() => onChange(qty - 1)} className="h-8 w-8 rounded-full ring-1 ring-line disabled:opacity-40">
            −
          </button>
          <span className="w-4 text-center text-sm tabular-nums">{qty}</span>
          <button type="button" aria-label={`Add one ${option.name}`} disabled={blocked || qty >= option.maxQuantity} onClick={() => onChange(qty + 1)} className="h-8 w-8 rounded-full ring-1 ring-line disabled:opacity-40">
            +
          </button>
        </span>
      ) : (
        <button
          type="button"
          role="checkbox"
          aria-checked={qty > 0}
          aria-label={option.name}
          disabled={blocked}
          onClick={() => onChange(qty ? 0 : 1)}
          className={`flex h-7 w-7 items-center justify-center rounded-full text-sm transition ${qty ? "bg-accent text-accent-contrast" : "ring-1 ring-line"}`}
        >
          {qty ? "✓" : ""}
        </button>
      )}
    </li>
  );
}

function SaveRecipe({
  slug,
  defaultName,
  selection,
  disabled,
  onSignIn,
}: {
  slug: string;
  defaultName: string;
  selection: Selection;
  disabled: boolean;
  onSignIn: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(defaultName);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  if (!open) {
    return (
      <span>
        {message && <span className="mr-3 text-accent">{message}</span>}
        <button type="button" disabled={disabled} onClick={() => setOpen(true)} className="font-medium text-accent hover:underline disabled:opacity-50">
          ♡ Save this recipe
        </button>
      </span>
    );
  }
  return (
    <form
      className="flex w-full gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const result = await saveDrink({ slug, name, selection });
          if (result.ok) setMessage(`Saved as “${name.trim()}”.`);
          else if (result.signIn) return onSignIn();
          else setMessage(result.error);
          setOpen(false);
        });
      }}
    >
      <input value={name} maxLength={60} required autoFocus aria-label="Recipe name" onChange={(e) => setName(e.target.value)} className="min-w-0 flex-1 rounded-full bg-background px-4 py-2 outline-none ring-1 ring-line focus:ring-accent" />
      <button disabled={pending} className="rounded-full bg-foreground px-4 py-2 font-medium text-background disabled:opacity-50">
        {pending ? "Saving…" : "Save"}
      </button>
    </form>
  );
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { saveDrink } from "@/app/actions/customer";
import { useCart } from "@/components/cart";
import { CupPreview } from "@/components/cup-preview";
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

export function DrinkBuilder({ drink }: { drink: DrinkConfig }) {
  const cart = useCart();
  const [selection, setSelection] = useState<Selection>(() => initialSelection(drink));
  const [message, setMessage] = useState("");

  // Saved drinks open the builder with their recipe in the URL hash (#s=...).
  useEffect(() => {
    const encoded = new URLSearchParams(window.location.hash.slice(1)).get("s");
    if (!encoded) return;
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reading the URL hash after hydration
      setSelection(completeSelection(drink, JSON.parse(encoded)));
    } catch {}
  }, [drink]);

  const update = (next: Selection) => setSelection(completeSelection(drink, next));

  const choose = (group: DrinkGroup, option: DrinkOption) => {
    const next = { ...selection };
    for (const o of group.options) delete next[o.slug];
    next[option.slug] = 1;
    update(next);
  };

  const setQuantity = (option: DrinkOption, qty: number) => {
    const next = { ...selection };
    if (qty <= 0) delete next[option.slug];
    else next[option.slug] = Math.min(qty, option.maxQuantity);
    update(next);
  };

  const groups = visibleGroups(drink, selection);
  const price = priceDrink(drink, selection);
  const summary = describeSelection(drink, selection);

  const has = (slug: string) => (selection[slug] ?? 0) > 0;
  const size = has("large") ? "large" : has("medium") ? "medium" : "small";
  const milk = drink.groups.some((g) => g.slug === "milk") && !has("no-milk");
  const syrup = ["vanilla-syrup", "caramel-syrup", "hazelnut-syrup", "mocha-sauce"].some(has);
  const topping = has("whipped-cream") ? "whip" : has("cold-foam") ? "foam" : null;

  return (
    <div className="mt-8 grid gap-10 md:grid-cols-[1fr_280px]">
      <div className="space-y-8">
        {groups.map((group) => (
          <fieldset key={group.slug}>
            <legend className="mb-3 flex w-full items-baseline justify-between font-semibold">
              {group.name}
              {group.selection === "multi" && (
                <span className="text-xs font-normal text-muted">Up to {group.maxSelected}</span>
              )}
            </legend>
            {group.selection === "single" ? (
              <div className="flex flex-wrap gap-2">
                {group.options.map((option) => (
                  <label
                    key={option.slug}
                    className={`cursor-pointer rounded-full border px-4 py-2 text-sm transition has-focus-visible:ring-2 has-focus-visible:ring-accent ${
                      has(option.slug)
                        ? "border-accent bg-accent-soft font-medium"
                        : "border-line bg-card hover:border-accent"
                    }`}
                  >
                    <input
                      type="radio"
                      name={group.slug}
                      className="sr-only"
                      checked={has(option.slug)}
                      onChange={() => choose(group, option)}
                    />
                    {option.name}
                    {option.priceDeltaCents > 0 && (
                      <span className="ml-1 text-muted">+{formatCents(option.priceDeltaCents)}</span>
                    )}
                  </label>
                ))}
              </div>
            ) : (
              <MultiGroup
                group={group}
                selection={selection}
                included={drink.defaults}
                onChange={setQuantity}
              />
            )}
          </fieldset>
        ))}
      </div>

      <aside className="md:sticky md:top-6 md:self-start">
        <div className="rounded-2xl border border-line bg-card p-6">
          <div className="flex justify-center">
            <CupPreview
              size={size}
              iced={has("iced")}
              shots={selection["espresso-shot"] ?? 0}
              milk={milk}
              syrup={syrup}
              topping={topping}
            />
          </div>
          <p className="mt-6 text-sm text-muted" aria-live="polite">
            {summary.join(" · ")}
          </p>
          <div className="mt-4 flex items-baseline justify-between border-t border-line pt-4">
            <span className="font-medium">Total</span>
            <span className="font-display text-2xl font-semibold tabular-nums" aria-live="polite">
              {price.ok ? formatCents(price.totalCents) : "—"}
            </span>
          </div>
          {!price.ok && <p className="mt-2 text-sm text-red-600">{price.errors[0]}</p>}
          <button
            type="button"
            disabled={!price.ok}
            onClick={() => {
              if (!price.ok) return;
              cart.add({
                slug: drink.slug,
                drinkName: drink.name,
                summary: summary.join(" · "),
                selection,
                unitPriceCents: price.totalCents,
                quantity: 1,
              });
              setMessage("Added to your order.");
            }}
            className="mt-5 w-full rounded-full bg-accent px-5 py-3 font-medium text-accent-contrast hover:opacity-90 disabled:opacity-50"
          >
            Add to order
          </button>
          <SaveDrink slug={drink.slug} defaultName={drink.isCustom ? "My coffee" : `My ${drink.name}`} selection={selection} disabled={!price.ok} onSaved={setMessage} />
          {message && (
            <p className="mt-3 text-center text-sm text-accent" role="status">
              {message}{" "}
              {message.startsWith("Added") && (
                <Link href="/cart" className="underline">
                  View cart
                </Link>
              )}
            </p>
          )}
          <button
            type="button"
            onClick={() => setSelection(initialSelection(drink))}
            className="mt-3 w-full text-sm text-muted hover:text-accent"
          >
            Reset to original recipe
          </button>
        </div>
      </aside>
    </div>
  );
}

function MultiGroup({
  group,
  selection,
  included,
  onChange,
}: {
  group: DrinkGroup;
  selection: Selection;
  included: Record<string, number>;
  onChange: (option: DrinkOption, qty: number) => void;
}) {
  const pickedCount = group.options.filter((o) => (selection[o.slug] ?? 0) > 0).length;
  const full = pickedCount >= group.maxSelected;

  return (
    <ul className="divide-y divide-line rounded-2xl border border-line bg-card">
      {group.options.map((option) => {
        const qty = selection[option.slug] ?? 0;
        const blocked = qty === 0 && full;
        const free = included[option.slug] ?? 0;
        return (
          <li key={option.slug} className="flex items-center justify-between gap-4 px-4 py-3">
            <div className={blocked ? "opacity-50" : undefined}>
              <span className="text-sm font-medium">{option.name}</span>
              <span className="ml-2 text-xs text-muted">
                {option.priceDeltaCents > 0
                  ? `+${formatCents(option.priceDeltaCents)}${option.maxQuantity > 1 ? " each" : ""}`
                  : "Free"}
                {free > 0 && option.priceDeltaCents > 0 ? ` · ${free} included` : ""}
              </span>
            </div>
            {option.maxQuantity > 1 ? (
              <div className="flex items-center gap-3">
                <StepButton label={`Remove one ${option.name}`} disabled={qty === 0} onClick={() => onChange(option, qty - 1)}>
                  −
                </StepButton>
                <span className="w-4 text-center text-sm tabular-nums">{qty}</span>
                <StepButton
                  label={`Add one ${option.name}`}
                  disabled={blocked || qty >= option.maxQuantity}
                  onClick={() => onChange(option, qty + 1)}
                >
                  +
                </StepButton>
              </div>
            ) : (
              <input
                type="checkbox"
                aria-label={option.name}
                className="h-5 w-5 accent-accent"
                checked={qty > 0}
                disabled={blocked}
                onChange={(e) => onChange(option, e.target.checked ? 1 : 0)}
              />
            )}
          </li>
        );
      })}
    </ul>
  );
}

function StepButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex h-8 w-8 items-center justify-center rounded-full border border-line text-lg leading-none hover:border-accent disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function SaveDrink({
  slug,
  defaultName,
  selection,
  disabled,
  onSaved,
}: {
  slug: string;
  defaultName: string;
  selection: Selection;
  disabled: boolean;
  onSaved: (message: string) => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(defaultName);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  if (!open) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className="mt-3 w-full rounded-full border border-line px-5 py-3 font-medium hover:border-accent disabled:opacity-50"
      >
        Save drink
      </button>
    );
  }

  return (
    <form
      className="mt-3"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const result = await saveDrink({ slug, name, selection });
          if (result.ok) {
            setOpen(false);
            setError("");
            onSaved(`Saved as “${name.trim()}”.`);
          } else if (result.signIn) {
            router.push(`/sign-in?next=${encodeURIComponent(window.location.pathname)}`);
          } else {
            setError(result.error);
          }
        });
      }}
    >
      <label className="text-sm font-medium">
        Name your drink
        <input
          value={name}
          maxLength={60}
          required
          autoFocus
          onChange={(e) => setName(e.target.value)}
          className="mt-1 w-full rounded-xl border border-line bg-background px-3 py-2 outline-none focus:border-accent"
        />
      </label>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      <div className="mt-2 flex gap-2">
        <button
          disabled={pending}
          className="flex-1 rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="px-3 text-sm text-muted hover:text-accent">
          Cancel
        </button>
      </div>
    </form>
  );
}

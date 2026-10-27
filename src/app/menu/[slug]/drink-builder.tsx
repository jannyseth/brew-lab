"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { saveDrink } from "@/app/actions/customer";
import { MAX_QUANTITY, useCart } from "@/components/cart";
import { CupStage } from "@/components/cup-stage";
import { cupVisual } from "@/lib/cup-visual";
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
import { estimateNutrition } from "@/lib/nutrition";

// A station-by-station builder, inspired by Papa's Freezeria: the cup stays in
// the middle and each station slides in beside it, so nothing needs scrolling.

const STATIONS = [
  { id: "temp", label: "Hot or iced", title: "Hot or iced?", groups: ["temperature", "ice"] },
  { id: "size", label: "Size", title: "Pick your size", groups: ["size"] },
  { id: "espresso", label: "Espresso", title: "Espresso", groups: ["roast", "shots"] },
  { id: "milk", label: "Milk", title: "Choose your milk", groups: ["milk"] },
  { id: "flavor", label: "Flavor", title: "Add flavor", groups: ["syrups", "sweeteners"] },
  { id: "toppings", label: "Toppings", title: "Top it off", groups: ["toppings"] },
  { id: "review", label: "Review", title: "Your drink", groups: [] },
] as const;
type StationId = (typeof STATIONS)[number]["id"];

/** Small visual cues on the option tiles. */
const SWATCH: Record<string, string> = {
  "whole-milk": "#efe0c8",
  "skim-milk": "#f5ede1",
  "oat-milk": "#e4c99c",
  "almond-milk": "#eddbc0",
  "soy-milk": "#e9d6b2",
  "no-milk": "transparent",
  "vanilla-syrup": "#f1dfa8",
  "caramel-syrup": "#c98a3d",
  "hazelnut-syrup": "#a0683a",
  "mocha-sauce": "#5a3220",
  "signature-roast": "#3b2214",
  "blonde-roast": "#8a5a2e",
  "decaf-roast": "#6b4a33",
  "espresso-shot": "#3b2214",
  "whipped-cream": "#fffaf2",
  "cold-foam": "#fbf1e3",
  "caramel-drizzle": "#b8702c",
  cinnamon: "#8b4b22",
  sugar: "#ffffff",
  "brown-sugar": "#b07a46",
  stevia: "#dfe9d8",
};
const ICON: Record<string, string> = { hot: "☕", iced: "🧊", "light-ice": "🧊", "regular-ice": "🧊🧊", "extra-ice": "🧊🧊🧊" };
const SIZE_SCALE: Record<string, number> = { small: 0.7, medium: 0.85, large: 1 };

export function DrinkBuilder({ drink }: { drink: DrinkConfig }) {
  const cart = useCart();
  const [selection, setSelection] = useState<Selection>(() => initialSelection(drink));
  const [stationId, setStationId] = useState<StationId>("temp");
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  // In stations with several add-on lists (Flavor: syrups + sweeteners), one list shows at a time.
  const [tab, setTab] = useState<Record<string, string>>({});
  const advanceTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Saved drinks open the builder with their recipe in the URL hash (#s=...).
  useEffect(() => {
    const encoded = new URLSearchParams(window.location.hash.slice(1)).get("s");
    if (!encoded) return;
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reading the URL hash after hydration
      setSelection(completeSelection(drink, JSON.parse(encoded)));
      setStationId("review");
    } catch {}
  }, [drink]);
  useEffect(() => () => clearTimeout(advanceTimer.current), []);

  const visible = visibleGroups(drink, selection);
  // A station appears only if it has a real choice for this drink.
  const stations = STATIONS.filter(
    (s) =>
      s.id === "review" ||
      visible.some((g) => (s.groups as readonly string[]).includes(g.slug) && (g.selection === "multi" || g.options.length > 1)),
  );
  const index = Math.max(0, stations.findIndex((s) => s.id === stationId));
  const station = stations[index];
  const price = priceDrink(drink, selection);
  const summary = describeSelection(drink, selection);
  const visual = cupVisual(drink, selection);
  const nutrition = estimateNutrition(drink, selection);

  const go = (to: number) => {
    clearTimeout(advanceTimer.current);
    const next = stations[Math.min(stations.length - 1, Math.max(0, to))];
    setStationId(next.id);
    setAdded(false);
  };
  const update = (next: Selection) => {
    setSelection(completeSelection(drink, next));
    setAdded(false);
  };

  const choose = (group: DrinkGroup, option: DrinkOption, stationGroupSlugs: readonly string[]) => {
    const next = { ...selection };
    for (const o of group.options) delete next[o.slug];
    next[option.slug] = 1;
    update(next);
    // A choice that reveals another (Iced → Ice level): bring it into view.
    requestAnimationFrame(() => {
      const revealed = drink.groups.find((g) => g.requiresOptionSlug === option.slug);
      if (revealed) document.querySelector(`[data-group="${revealed.slug}"]`)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
    // Auto-advance when this was the station's last choice, e.g. Hot (but not Iced, which then asks for ice level).
    // Check against everything the station can show, including groups this choice just revealed.
    const after = visibleGroups(drink, completeSelection(drink, next)).filter((g) => stationGroupSlugs.includes(g.slug));
    if (after.at(-1)?.slug === group.slug && after.every((g) => g.selection === "single")) {
      clearTimeout(advanceTimer.current);
      advanceTimer.current = setTimeout(() => go(index + 1), 450);
    }
  };
  const setQty = (option: DrinkOption, qty: number) => {
    const next = { ...selection };
    if (qty <= 0) delete next[option.slug];
    else next[option.slug] = Math.min(qty, option.maxQuantity);
    update(next);
  };

  return (
    <div className="mx-auto grid h-[calc(100dvh-var(--header-h,5rem))] min-h-[540px] max-w-6xl grid-cols-[minmax(0,1fr)] grid-rows-[minmax(0,32%)_minmax(0,1fr)] gap-3 [@media(max-height:740px)]:grid-rows-[minmax(0,24%)_minmax(0,1fr)] px-4 py-3 md:grid-cols-[minmax(0,1fr)_440px] md:grid-rows-1 md:gap-8 md:py-6">
      {/* The cup */}
      <section className="flex min-h-0 flex-col">
        <div className="flex items-center justify-between gap-3">
          <Link href="/menu" className="text-sm text-muted hover:text-accent">
            ← Menu
          </Link>
          <p className="truncate font-display text-lg font-semibold md:text-2xl">{drink.name}</p>
          <p className="font-display text-lg font-semibold tabular-nums md:text-2xl" aria-live="polite">
            {price.ok ? formatCents(price.totalCents * quantity) : "—"}
          </p>
        </div>
        <div className="mt-2 min-h-0 flex-1 rounded-3xl bg-gradient-to-b from-accent-soft to-transparent p-2 md:p-6">
          <CupStage visual={visual} nutrition={nutrition} title={summary.join(" · ") || drink.name} />
        </div>
        <p className="mt-2 hidden truncate text-center text-sm text-muted md:block" aria-live="polite">
          {summary.join(" · ")}
        </p>
      </section>

      {/* The stations */}
      <section className="flex min-h-0 flex-col rounded-3xl border border-line bg-card shadow-sm">
        <nav aria-label="Drink builder steps" className="flex gap-1 border-b border-line px-3 pt-3">
          {stations.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onClick={() => go(i)}
              aria-current={i === index ? "step" : undefined}
              className="group flex-1 pb-2 text-center"
              title={s.label}
            >
              <span className={`block h-1.5 rounded-full transition-colors ${i <= index ? "bg-accent" : "bg-line"}`} />
              <span className={`mt-1.5 hidden text-[11px] lg:block ${i === index ? "font-semibold" : "text-muted group-hover:text-foreground"}`}>
                {s.label}
              </span>
            </button>
          ))}
        </nav>

        {/* overflow-clip (not hidden) so focus or scrollIntoView can never shift the stations sideways */}
        <div className="relative min-h-0 flex-1 overflow-clip">
          <div
            className="flex h-full transition-transform duration-500 ease-[cubic-bezier(.2,.8,.2,1)]"
            style={{ transform: `translateX(-${index * 100}%)` }}
          >
            {stations.map((s, i) => {
              const groups = visible.filter((g) => (s.groups as readonly string[]).includes(g.slug));
              return (
                <div
                  key={s.id}
                  className="h-full w-full shrink-0 overflow-y-auto p-4 md:p-5"
                  aria-hidden={i !== index}
                  inert={i !== index}
                >
                  <p className="text-xs font-semibold uppercase tracking-widest text-accent">
                    Station {i + 1} of {stations.length}
                  </p>
                  <h2 className="mt-1 font-display text-2xl font-semibold">{s.title}</h2>
                  {s.id === "review" ? (
                    <Review
                      drink={drink}
                      summary={summary}
                      selection={selection}
                      priceCents={price.ok ? price.totalCents : null}
                      error={price.ok ? null : price.errors[0]}
                      quantity={quantity}
                      setQuantity={(q) => {
                        setQuantity(Math.min(MAX_QUANTITY, Math.max(1, q)));
                        setAdded(false);
                      }}
                      added={added}
                      onAdd={() => {
                        if (!price.ok) return;
                        cart.add({
                          slug: drink.slug,
                          drinkName: drink.name,
                          summary: summary.join(" · "),
                          selection,
                          unitPriceCents: price.totalCents,
                          quantity,
                        });
                        setAdded(true);
                      }}
                      onRestart={() => {
                        setSelection(initialSelection(drink));
                        setQuantity(1);
                        go(0);
                      }}
                    />
                  ) : (
                    <StationChoices
                      groups={groups}
                      title={s.title}
                      activeTab={tab[s.id] ?? groups[0]?.slug}
                      onTab={(slug) => setTab({ ...tab, [s.id]: slug })}
                      selection={selection}
                      included={drink.defaults}
                      onChoose={(group, option) => choose(group, option, s.groups)}
                      onQuantity={setQty}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-line p-3">
          <button
            type="button"
            onClick={() => go(index - 1)}
            disabled={index === 0}
            className="rounded-full px-4 py-2.5 text-sm font-medium text-muted hover:text-foreground disabled:invisible"
          >
            ← Back
          </button>
          {station.id !== "review" && (
            <button
              type="button"
              onClick={() => go(index + 1)}
              className="rounded-full bg-accent px-6 py-2.5 text-sm font-medium text-accent-contrast hover:opacity-90"
            >
              {stations[index + 1]?.id === "review" ? "Review drink →" : "Next →"}
            </button>
          )}
        </div>
      </section>
    </div>
  );
}

/** The choices of one station; stations with several add-on lists get tabs. */
function StationChoices({
  groups,
  title,
  activeTab,
  onTab,
  selection,
  included,
  onChoose,
  onQuantity,
}: {
  groups: DrinkGroup[];
  title: string;
  activeTab: string | undefined;
  onTab: (slug: string) => void;
  selection: Selection;
  included: Record<string, number>;
  onChoose: (group: DrinkGroup, option: DrinkOption) => void;
  onQuantity: (option: DrinkOption, qty: number) => void;
}) {
  const has = (slug: string) => (selection[slug] ?? 0) > 0;
  const tabbed = groups.filter((g) => g.selection === "multi").length > 1;
  const shown = tabbed ? groups.filter((g) => g.slug === activeTab) : groups;
  return (
    <>
      {tabbed && (
        <div role="tablist" aria-label={title} className="mt-3 flex gap-1 rounded-full bg-background p-1 ring-1 ring-line">
          {groups.map((g) => {
            const picked = g.options.filter((o) => has(o.slug)).length;
            return (
              <button
                key={g.slug}
                type="button"
                role="tab"
                aria-selected={g.slug === activeTab}
                onClick={() => onTab(g.slug)}
                className={`flex-1 rounded-full px-3 py-1.5 text-sm font-medium transition ${
                  g.slug === activeTab ? "bg-card shadow-sm ring-1 ring-line" : "text-muted hover:text-foreground"
                }`}
              >
                {g.name}
                {picked > 0 && <span className="ml-1.5 rounded-full bg-accent px-1.5 text-xs text-accent-contrast">{picked}</span>}
              </button>
            );
          })}
        </div>
      )}
      {shown.map((group) => (
        <fieldset key={group.slug} className="mt-3 scroll-mt-2 sm:mt-4" data-group={group.slug}>
          <legend className="mb-2 flex w-full items-baseline justify-between text-sm font-semibold">
            {group.name}
            {group.selection === "multi" && <span className="text-xs font-normal text-muted">Up to {group.maxSelected}</span>}
          </legend>
          <div
            className={`grid gap-2 ${
              group.options.some((o) => o.maxQuantity > 1)
                ? "grid-cols-1 sm:grid-cols-2"
                : group.options.length > 3
                  ? "grid-cols-2"
                  : "grid-cols-3"
            }`}
          >
            {group.options.map((option) =>
              group.selection === "single" ? (
                <ChoiceTile key={option.slug} option={option} selected={has(option.slug)} onSelect={() => onChoose(group, option)} />
              ) : (
                <AddOnTile
                  key={option.slug}
                  option={option}
                  qty={selection[option.slug] ?? 0}
                  included={included[option.slug] ?? 0}
                  blocked={!has(option.slug) && group.options.filter((o) => has(o.slug)).length >= group.maxSelected}
                  onChange={(qty) => onQuantity(option, qty)}
                />
              ),
            )}
          </div>
        </fieldset>
      ))}
    </>
  );
}

function Swatch({ slug }: { slug: string }) {
  if (ICON[slug]) return <span className="text-xl leading-none">{ICON[slug]}</span>;
  if (SIZE_SCALE[slug]) {
    return (
      <svg viewBox="0 0 24 30" className="h-7 w-6" aria-hidden>
        <path
          d="M3 4h18l-2.5 24h-13z"
          fill="var(--accent-soft)"
          stroke="var(--accent)"
          strokeWidth="1.5"
          style={{ transform: `scale(${SIZE_SCALE[slug]})`, transformOrigin: "12px 28px" }}
        />
      </svg>
    );
  }
  const color = SWATCH[slug];
  if (!color) return null;
  return (
    <span
      className="block h-6 w-6 rounded-full ring-1 ring-line"
      style={{ background: color === "transparent" ? "repeating-linear-gradient(45deg,var(--line) 0 2px,transparent 2px 6px)" : color }}
    />
  );
}

function ChoiceTile({ option, selected, onSelect }: { option: DrinkOption; selected: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`flex min-h-16 flex-col items-center justify-center gap-1 rounded-2xl border-2 p-2 text-center text-sm transition active:scale-95 sm:min-h-20 sm:gap-1.5 ${
        selected ? "border-accent bg-accent-soft font-semibold" : "border-line hover:border-accent"
      }`}
    >
      <Swatch slug={option.slug} />
      <span className="leading-tight">{option.name}</span>
      {option.priceDeltaCents > 0 && <span className="text-xs text-muted">+{formatCents(option.priceDeltaCents)}</span>}
    </button>
  );
}

function AddOnTile({
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
  const priceNote =
    option.priceDeltaCents > 0 ? `+${formatCents(option.priceDeltaCents)}${counter ? " each" : ""}${included ? ` · ${included} incl.` : ""}` : "Free";
  if (!counter) {
    return (
      <button
        type="button"
        onClick={() => onChange(qty ? 0 : 1)}
        disabled={blocked}
        aria-pressed={qty > 0}
        className={`flex min-h-16 flex-col items-center justify-center gap-1 rounded-2xl border-2 p-2 text-center text-sm transition active:scale-95 disabled:opacity-40 sm:min-h-20 sm:gap-1.5 ${
          qty ? "border-accent bg-accent-soft font-semibold" : "border-line hover:border-accent"
        }`}
      >
        <Swatch slug={option.slug} />
        <span className="leading-tight">{option.name}</span>
        <span className="text-xs text-muted">{priceNote}</span>
      </button>
    );
  }
  return (
    // A single compact row on phones, a tile on larger screens.
    <div
      className={`flex items-center justify-between gap-2 rounded-2xl border-2 px-3 py-1 text-sm sm:min-h-20 sm:flex-col sm:justify-center sm:gap-1 sm:p-2 sm:text-center ${
        qty ? "border-accent bg-accent-soft" : "border-line"
      } ${blocked ? "opacity-40" : ""}`}
    >
      <span className="flex min-w-0 items-center gap-2">
        <Swatch slug={option.slug} />
        <span className="min-w-0 text-left sm:text-center">
          <span className={`block truncate leading-tight ${qty ? "font-semibold" : ""}`}>{option.name}</span>
          <span className="block text-[11px] text-muted sm:hidden">{priceNote}</span>
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-3">
        <button
          type="button"
          aria-label={`Remove one ${option.name}`}
          disabled={qty === 0}
          onClick={() => onChange(qty - 1)}
          className="h-8 w-8 rounded-full border border-line bg-card text-lg leading-none active:scale-90 disabled:opacity-40"
        >
          −
        </button>
        <span className="w-4 tabular-nums" aria-live="polite">
          {qty}
        </span>
        <button
          type="button"
          aria-label={`Add one ${option.name}`}
          disabled={blocked || qty >= option.maxQuantity}
          onClick={() => onChange(qty + 1)}
          className="h-8 w-8 rounded-full border border-line bg-card text-lg leading-none active:scale-90 disabled:opacity-40"
        >
          +
        </button>
      </span>
      <span className="hidden text-[11px] text-muted sm:block">{priceNote}</span>
    </div>
  );
}

function Review({
  drink,
  summary,
  selection,
  priceCents,
  error,
  quantity,
  setQuantity,
  added,
  onAdd,
  onRestart,
}: {
  drink: DrinkConfig;
  summary: string[];
  selection: Selection;
  priceCents: number | null;
  error: string | null;
  quantity: number;
  setQuantity: (q: number) => void;
  added: boolean;
  onAdd: () => void;
  onRestart: () => void;
}) {
  return (
    <div className="mt-4">
      <ul className="flex flex-wrap gap-1.5">
        {summary.map((s) => (
          <li key={s} className="rounded-full bg-accent-soft px-3 py-1 text-xs font-medium">
            {s}
          </li>
        ))}
      </ul>
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      <div className="mt-5 flex items-center justify-between">
        <span className="text-sm font-medium">Quantity</span>
        <span className="flex items-center gap-3">
          <button type="button" aria-label="One fewer" onClick={() => setQuantity(quantity - 1)} disabled={quantity <= 1} className="h-9 w-9 rounded-full border border-line text-lg disabled:opacity-40">
            −
          </button>
          <span className="w-5 text-center tabular-nums">{quantity}</span>
          <button type="button" aria-label="One more" onClick={() => setQuantity(quantity + 1)} disabled={quantity >= MAX_QUANTITY} className="h-9 w-9 rounded-full border border-line text-lg disabled:opacity-40">
            +
          </button>
        </span>
      </div>

      {added ? (
        <div className="mt-5 rounded-2xl bg-accent-soft p-4 text-center" role="status">
          <p className="font-semibold">Added to your order ✓</p>
          <div className="mt-3 flex justify-center gap-2">
            <Link href="/cart" className="rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-accent-contrast">
              Checkout
            </Link>
            <Link href="/menu" className="rounded-full border border-line bg-card px-5 py-2.5 text-sm font-medium">
              Add another drink
            </Link>
          </div>
        </div>
      ) : (
        <button
          type="button"
          disabled={priceCents === null}
          onClick={onAdd}
          className="mt-5 flex w-full items-center justify-between rounded-full bg-accent px-6 py-3.5 font-medium text-accent-contrast hover:opacity-90 disabled:opacity-50"
        >
          <span>Add to order</span>
          <span className="tabular-nums">{priceCents !== null ? formatCents(priceCents * quantity) : ""}</span>
        </button>
      )}
      <SaveDrink slug={drink.slug} defaultName={drink.isCustom ? "My coffee" : `My ${drink.name}`} selection={selection} disabled={priceCents === null} />
      <button type="button" onClick={onRestart} className="mt-3 w-full text-sm text-muted hover:text-accent">
        Start over
      </button>
    </div>
  );
}

function SaveDrink({ slug, defaultName, selection, disabled }: { slug: string; defaultName: string; selection: Selection; disabled: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(defaultName);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  if (!open) {
    return (
      <>
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen(true)}
          className="mt-3 w-full rounded-full border border-line px-5 py-3 text-sm font-medium hover:border-accent disabled:opacity-50"
        >
          Save this recipe
        </button>
        {message && (
          <p role="status" className="mt-2 text-center text-sm text-accent">
            {message}
          </p>
        )}
      </>
    );
  }

  return (
    <form
      className="mt-3 flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const result = await saveDrink({ slug, name, selection });
          if (result.ok) {
            setOpen(false);
            setMessage(`Saved as “${name.trim()}”.`);
          } else if (result.signIn) {
            router.push(`/sign-in?next=${encodeURIComponent(window.location.pathname)}`);
          } else {
            setMessage(result.error);
            setOpen(false);
          }
        });
      }}
    >
      <input
        value={name}
        maxLength={60}
        required
        autoFocus
        aria-label="Recipe name"
        onChange={(e) => setName(e.target.value)}
        className="min-w-0 flex-1 rounded-full border border-line bg-background px-4 py-2 text-sm outline-none focus:border-accent"
      />
      <button disabled={pending} className="rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50">
        {pending ? "Saving…" : "Save"}
      </button>
    </form>
  );
}

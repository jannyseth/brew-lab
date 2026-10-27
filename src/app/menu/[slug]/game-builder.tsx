"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { saveDrink } from "@/app/actions/customer";
import { MAX_QUANTITY, useCart } from "@/components/cart";
import { CupArt } from "@/components/cup-art";
import { cupVisual } from "@/lib/cup-visual";
import {
  describeSelection,
  formatCents,
  normalizeSelection,
  priceBreakdown,
  priceDrink,
  visibleGroups,
  type DrinkConfig,
  type DrinkGroup,
  type DrinkOption,
  type Selection,
} from "@/lib/drink";
import { estimateNutrition } from "@/lib/nutrition";

// Build Your Own as a little game, inspired by Papa's Freezeria: start with an
// empty cup, visit each station, tap ingredient tokens and watch them go in.
// At the end the drink is lidded, inspected, boxed and sent to the cart.

const STATIONS = [
  { id: "cup", icon: "🥤", name: "Cup", title: "Cup station", hint: "Pick a size, then hot or iced.", groups: ["size", "temperature", "ice"], required: ["size", "temperature", "ice"] },
  { id: "espresso", icon: "☕", name: "Espresso", title: "Espresso bar", hint: "Choose a roast. One shot is included; tap the shot for more.", groups: ["roast", "shots"], required: ["roast"] },
  { id: "milk", icon: "🥛", name: "Milk", title: "Milk fridge", hint: "Pick your milk, or go without.", groups: ["milk"], required: ["milk"] },
  { id: "flavor", icon: "🍯", name: "Flavor", title: "Flavor shelf", hint: "Each tap adds a pump or a spoon. Optional.", groups: ["syrups", "sweeteners"], required: [] },
  { id: "toppings", icon: "🍦", name: "Toppings", title: "Topping bar", hint: "Finish it off. Optional.", groups: ["toppings"], required: [] },
  { id: "inspect", icon: "🔍", name: "Inspect", title: "Inspect your coffee", hint: "Ready to go! Check it over before you order.", groups: [], required: [] },
] as const;

/** Token look: a fill color and an emoji for each ingredient. */
const TOKEN: Record<string, { color: string; emoji?: string }> = {
  hot: { color: "#f6d3b8", emoji: "🔥" },
  iced: { color: "#d7ecf3", emoji: "🧊" },
  "light-ice": { color: "#e6f3f7", emoji: "🧊" },
  "regular-ice": { color: "#d7ecf3", emoji: "🧊" },
  "extra-ice": { color: "#c3e2ec", emoji: "🧊" },
  "signature-roast": { color: "#3b2214", emoji: "🫘" },
  "blonde-roast": { color: "#a8743f", emoji: "🫘" },
  "decaf-roast": { color: "#6b4a33", emoji: "🫘" },
  "espresso-shot": { color: "#3b2214", emoji: "☕" },
  "whole-milk": { color: "#efe0c8", emoji: "🥛" },
  "skim-milk": { color: "#f5ede1", emoji: "🥛" },
  "oat-milk": { color: "#e4c99c", emoji: "🌾" },
  "almond-milk": { color: "#eddbc0", emoji: "🌰" },
  "soy-milk": { color: "#e9d6b2", emoji: "🫛" },
  "no-milk": { color: "#f1ebe4", emoji: "🚫" },
  "vanilla-syrup": { color: "#f1dfa8", emoji: "🌼" },
  "caramel-syrup": { color: "#c98a3d", emoji: "🍮" },
  "hazelnut-syrup": { color: "#a0683a", emoji: "🌰" },
  "mocha-sauce": { color: "#5a3220", emoji: "🍫" },
  sugar: { color: "#ffffff", emoji: "🧊" },
  "brown-sugar": { color: "#c99a6a", emoji: "🟫" },
  stevia: { color: "#dfe9d8", emoji: "🌿" },
  "whipped-cream": { color: "#fffaf2", emoji: "🍦" },
  "cold-foam": { color: "#fbf1e3", emoji: "☁️" },
  "caramel-drizzle": { color: "#b8702c", emoji: "🍯" },
  cinnamon: { color: "#8b4b22", emoji: "✨" },
};
const SIZE_HEIGHT: Record<string, number> = { small: 18, medium: 23, large: 28 };

type Phase = "build" | "boxing" | "flying";

export function GameBuilder({ drink }: { drink: DrinkConfig }) {
  const router = useRouter();
  const cart = useCart();
  const [selection, setSelection] = useState<Selection>({});
  const [station, setStation] = useState(0);
  const [reached, setReached] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [phase, setPhase] = useState<Phase>("build");
  const [bump, setBump] = useState<{ slug: string; n: number; kind: "pop" | "shake" } | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const bumps = useRef(0);

  // A saved recipe opens straight at the inspect station (#s=... in the URL).
  useEffect(() => {
    const encoded = new URLSearchParams(window.location.hash.slice(1)).get("s");
    if (!encoded) return;
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reading the URL hash after hydration
      setSelection(normalizeSelection(drink, JSON.parse(encoded)));
      setStation(STATIONS.length - 1);
      setReached(STATIONS.length - 1);
    } catch {}
  }, [drink]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const has = (slug: string) => (selection[slug] ?? 0) > 0;
  const visible = visibleGroups(drink, selection);
  const groupsFor = (i: number) => visible.filter((g) => (STATIONS[i].groups as readonly string[]).includes(g.slug));
  const missingFor = (i: number) =>
    groupsFor(i).filter((g) => (STATIONS[i].required as readonly string[]).includes(g.slug) && !g.options.some((o) => has(o.slug)));
  const firstIncomplete = STATIONS.findIndex((_, i) => missingFor(i).length > 0);
  const price = priceDrink(drink, selection);
  const ready = firstIncomplete === -1 && price.ok;
  const current = STATIONS[station];
  const missing = missingFor(station);
  const inspecting = current.id === "inspect";
  const visual = cupVisual(drink, selection);
  const nutrition = estimateNutrition(drink, selection);
  const summary = describeSelection(drink, selection);

  const animateToken = (slug: string, kind: "pop" | "shake") => {
    bumps.current += 1;
    setBump({ slug, n: bumps.current, kind });
  };
  const goTo = (i: number) => {
    // Stations open in order: you can't skip past one that still needs a choice.
    const limit = firstIncomplete === -1 ? STATIONS.length - 1 : firstIncomplete;
    const next = Math.max(0, Math.min(i, limit));
    setStation(next);
    setReached((r) => Math.max(r, next));
  };

  const pick = (group: DrinkGroup, option: DrinkOption) => {
    const next: Selection = { ...selection };
    for (const o of group.options) delete next[o.slug];
    next[option.slug] = 1;
    // Conveniences: iced starts on regular ice, and choosing a roast pours the included shot.
    if (option.slug === "iced" && !["light-ice", "regular-ice", "extra-ice"].some((s) => next[s])) next["regular-ice"] = 1;
    if (group.slug === "roast" && !next["espresso-shot"]) next["espresso-shot"] = drink.defaults["espresso-shot"] || 1;
    setSelection(normalizeSelection(drink, next));
    animateToken(option.slug, "pop");
  };

  const changeCount = (group: DrinkGroup, option: DrinkOption, delta: number) => {
    const qty = selection[option.slug] ?? 0;
    const distinct = group.options.filter((o) => has(o.slug)).length;
    // Once a roast is chosen the cup keeps at least its included shot.
    const roastChosen = ["signature-roast", "blonde-roast", "decaf-roast"].some(has);
    const min = option.slug === "espresso-shot" && roastChosen ? 1 : 0;
    const target = qty + delta;
    if (target > option.maxQuantity || target < min || (qty === 0 && delta > 0 && distinct >= group.maxSelected)) {
      animateToken(option.slug, "shake");
      return;
    }
    const next = { ...selection };
    if (target <= 0) delete next[option.slug];
    else next[option.slug] = target;
    setSelection(normalizeSelection(drink, next));
    animateToken(option.slug, "pop");
  };

  const toggle = (option: DrinkOption, group: DrinkGroup) => {
    if (has(option.slug)) changeCount(group, option, -1);
    else changeCount(group, option, 1);
  };

  const order = () => {
    if (!price.ok) return;
    cart.add({
      slug: drink.slug,
      drinkName: drink.name,
      summary: summary.join(" · "),
      selection,
      unitPriceCents: price.totalCents,
      quantity,
    });
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return router.push("/cart");
    setPhase("boxing");
    timers.current.push(setTimeout(() => setPhase("flying"), 1300));
    timers.current.push(setTimeout(() => router.push("/cart"), 2050));
  };

  // A running total while building; "from" only while the cup is still empty.
  const running = priceBreakdown(drink, selection).reduce((sum, l) => sum + l.cents, 0);
  const priceLabel = summary.length === 0 ? `from ${formatCents(drink.basePriceCents)}` : formatCents(running * quantity);

  return (
    <div className="mx-auto flex h-[calc(100dvh-var(--header-h,5rem))] min-h-[560px] max-w-6xl flex-col gap-3 px-4 py-3 md:py-5">
      {/* Station rail */}
      <nav aria-label="Stations" className="flex items-center gap-1">
        <Link href="/menu" className="mr-2 hidden text-sm text-muted hover:text-accent sm:inline">
          ← Menu
        </Link>
        {STATIONS.map((s, i) => {
          const done = i < station || (i <= reached && missingFor(i).length === 0 && i !== station);
          const locked = firstIncomplete !== -1 && i > firstIncomplete;
          return (
            <div key={s.id} className="flex flex-1 items-center gap-1">
              <button
                type="button"
                onClick={() => goTo(i)}
                disabled={locked || phase !== "build"}
                aria-current={i === station ? "step" : undefined}
                aria-label={`Station ${i + 1}: ${s.name}${locked ? " (locked)" : ""}`}
                className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg transition sm:h-12 sm:w-12 ${
                  i === station
                    ? "scale-110 bg-accent shadow-md ring-4 ring-accent-soft"
                    : done
                      ? "bg-accent-soft ring-1 ring-accent"
                      : "bg-card ring-1 ring-line"
                } ${locked ? "opacity-40" : "hover:scale-105"}`}
              >
                <span aria-hidden>{s.icon}</span>
                {done && i !== station && (
                  <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-[10px] text-accent-contrast">
                    ✓
                  </span>
                )}
              </button>
              {i < STATIONS.length - 1 && <span className={`h-1 flex-1 rounded-full ${i < station ? "bg-accent" : "bg-line"}`} />}
            </div>
          );
        })}
      </nav>

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)] grid-rows-[minmax(0,42%)_minmax(0,1fr)] gap-3 md:grid-cols-[minmax(0,1fr)_440px] md:grid-rows-1 md:gap-6">
        {/* The counter, with the cup */}
        <section className="relative min-h-0 overflow-hidden rounded-3xl bg-gradient-to-b from-accent-soft via-background to-accent-soft/60 ring-1 ring-line">
          <div className="absolute inset-x-0 bottom-0 h-[18%] bg-gradient-to-b from-[#c79a6b]/40 to-[#a87648]/40" aria-hidden />
          <p className="absolute left-4 top-3 z-10 font-display text-lg font-semibold md:text-xl">{drink.name}</p>
          <p className="absolute right-3 top-3 z-10 rounded-full bg-card px-3 py-1 text-sm font-semibold tabular-nums shadow-sm ring-1 ring-line" aria-live="polite">
            {priceLabel}
          </p>
          <div
            className={`absolute inset-x-0 bottom-[6%] top-[12%] flex justify-center ${phase === "flying" ? "box-fly" : ""}`}
            aria-label={summary.length ? `Your cup: ${summary.join(", ")}` : "An empty cup"}
            role="img"
          >
            <CupArt visual={visual} animate covered={inspecting || phase !== "build"} className="h-full w-auto drop-shadow-md" />
            {phase !== "build" && <Box />}
          </div>
          {summary.length === 0 && (
            <p className="absolute inset-x-0 bottom-3 text-center text-sm text-muted">An empty cup, waiting for you.</p>
          )}
        </section>

        {/* The station tray */}
        <section className="flex min-h-0 flex-col rounded-3xl bg-card shadow-sm ring-1 ring-line">
          <header key={current.id} className="station-in border-b border-line px-4 pb-3 pt-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-accent">
              Station {station + 1} of {STATIONS.length}
            </p>
            <h1 className="font-display text-2xl font-semibold">{current.title}</h1>
            <p className="text-sm text-muted">{current.hint}</p>
          </header>

          <div key={`body-${current.id}`} className="station-in min-h-0 flex-1 overflow-y-auto px-4 py-3">
            {inspecting ? (
              <Inspect
                drink={drink}
                selection={selection}
                nutrition={nutrition}
                saveDisabled={!price.ok || phase !== "build"}
              />
            ) : (
              groupsFor(station).map((group) => (
                <fieldset key={group.slug} className="mb-4">
                  <legend className="mb-2 flex w-full items-baseline justify-between text-sm font-semibold">
                    {group.name}
                    {group.selection === "multi" && (
                      <span className="text-xs font-normal text-muted">
                        {group.options.some((o) => o.maxQuantity > 1) ? "Tap to add, − to remove" : `Up to ${group.maxSelected}`}
                      </span>
                    )}
                  </legend>
                  <div className="flex flex-wrap gap-x-2 gap-y-3">
                    {group.options.map((option) => (
                      <Token
                        key={option.slug}
                        group={group}
                        option={option}
                        qty={selection[option.slug] ?? 0}
                        included={drink.defaults[option.slug] ?? 0}
                        animation={bump?.slug === option.slug ? bump : null}
                        onTap={() =>
                          group.selection === "single"
                            ? pick(group, option)
                            : option.maxQuantity > 1
                              ? changeCount(group, option, 1)
                              : toggle(option, group)
                        }
                        onRemove={() => changeCount(group, option, -1)}
                      />
                    ))}
                  </div>
                </fieldset>
              ))
            )}
          </div>

          <footer className="flex items-center justify-between gap-3 border-t border-line p-3">
            <button
              type="button"
              onClick={() => goTo(station - 1)}
              disabled={station === 0 || phase !== "build"}
              aria-label="Back to the previous station"
              className="rounded-full px-3 py-2.5 text-sm font-medium text-muted hover:text-foreground disabled:invisible sm:px-4"
            >
              ← <span className={inspecting ? "hidden sm:inline" : ""}>{station > 0 ? STATIONS[station - 1].name : "Back"}</span>
            </button>
            {inspecting && (
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1.5" aria-label="Quantity">
                  <button type="button" aria-label="One fewer" disabled={quantity <= 1 || phase !== "build"} onClick={() => setQuantity(quantity - 1)} className="h-8 w-8 rounded-full ring-1 ring-line disabled:opacity-40">
                    −
                  </button>
                  <span className="w-4 text-center text-sm font-semibold tabular-nums">{quantity}</span>
                  <button type="button" aria-label="One more" disabled={quantity >= MAX_QUANTITY || phase !== "build"} onClick={() => setQuantity(quantity + 1)} className="h-8 w-8 rounded-full ring-1 ring-line disabled:opacity-40">
                    +
                  </button>
                </span>
                <button
                  type="button"
                  disabled={!price.ok || phase !== "build"}
                  onClick={order}
                  className="whitespace-nowrap rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-accent-contrast shadow-sm transition hover:opacity-90 active:scale-95 disabled:opacity-60"
                >
                  {phase === "build" ? `Add to order · ${price.ok ? formatCents(price.totalCents * quantity) : ""}` : "Boxing it up…"}
                </button>
              </div>
            )}
            {!inspecting && (
              <div className="flex items-center gap-3">
                {missing.length > 0 && (
                  <span className="hidden text-xs text-muted sm:inline">Pick {missing.map((g) => g.name.toLowerCase()).join(" & ")}</span>
                )}
                <button
                  type="button"
                  onClick={() => goTo(station + 1)}
                  disabled={missing.length > 0}
                  title={missing.length ? `Pick ${missing.map((g) => g.name.toLowerCase()).join(" and ")} first` : undefined}
                  className="rounded-full bg-accent px-6 py-2.5 text-sm font-semibold text-accent-contrast shadow-sm transition hover:opacity-90 active:scale-95 disabled:opacity-40"
                >
                  {STATIONS[station + 1].id === "inspect" ? (ready ? "Finish & lid it →" : "Next →") : `${STATIONS[station + 1].name} →`}
                </button>
              </div>
            )}
          </footer>
        </section>
      </div>
    </div>
  );
}

/** One round ingredient token. Single choices select; counters add one per tap. */
function Token({
  group,
  option,
  qty,
  included,
  animation,
  onTap,
  onRemove,
}: {
  group: DrinkGroup;
  option: DrinkOption;
  qty: number;
  included: number;
  animation: { n: number; kind: "pop" | "shake" } | null;
  onTap: () => void;
  onRemove: () => void;
}) {
  const look = TOKEN[option.slug] ?? { color: "var(--accent-soft)" };
  const counter = group.selection === "multi" && option.maxQuantity > 1;
  const selected = qty > 0;
  const price =
    option.priceDeltaCents > 0
      ? `+${formatCents(option.priceDeltaCents)}${counter ? " each" : ""}`
      : "Free";
  return (
    <div className="relative flex w-[72px] flex-col items-center text-center sm:w-20">
      <button
        key={animation?.n}
        type="button"
        onClick={onTap}
        aria-pressed={group.selection === "single" || !counter ? selected : undefined}
        aria-label={`${counter ? "Add" : selected && group.selection === "multi" ? "Remove" : "Choose"} ${option.name}${counter && qty ? `, ${qty} added` : ""}`}
        className={`relative flex h-16 w-16 items-center justify-center rounded-full text-2xl shadow-sm transition hover:-translate-y-0.5 sm:h-[72px] sm:w-[72px] ${
          selected ? "ring-4 ring-accent" : "ring-1 ring-line"
        } ${animation ? (animation.kind === "pop" ? "token-pop" : "token-shake") : ""}`}
        style={{ background: `radial-gradient(circle at 35% 30%, #ffffff66, transparent 55%), ${look.color}` }}
      >
        {SIZE_HEIGHT[option.slug] ? (
          <svg viewBox="0 0 24 32" className="h-9 w-7" aria-hidden>
            <path
              d={`M4 ${30 - SIZE_HEIGHT[option.slug]}h16l-2.5 ${SIZE_HEIGHT[option.slug]}h-11z`}
              fill="var(--card)"
              stroke="var(--accent)"
              strokeWidth="1.8"
              strokeLinejoin="round"
            />
          </svg>
        ) : (
          <span aria-hidden className="drop-shadow-sm">
            {look.emoji}
          </span>
        )}
        {counter && qty > 0 && (
          <span className="absolute -right-1 -top-1 flex h-6 min-w-6 items-center justify-center rounded-full bg-accent px-1 text-xs font-bold text-accent-contrast shadow">
            {qty}
          </span>
        )}
        {!counter && selected && (
          <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-[11px] font-bold text-accent-contrast shadow">
            ✓
          </span>
        )}
      </button>
      {counter && qty > 0 && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove one ${option.name}`}
          className="absolute -left-0.5 top-0 flex h-6 w-6 items-center justify-center rounded-full bg-card text-sm font-bold shadow ring-1 ring-line active:scale-90"
        >
          −
        </button>
      )}
      <span className={`mt-1.5 text-xs leading-tight ${selected ? "font-semibold" : ""}`}>{option.name}</span>
      <span className="text-[10px] text-muted">{included && option.priceDeltaCents ? `${included} included` : price}</span>
    </div>
  );
}

/** The takeaway box that closes around the cup when the order is placed. */
function Box() {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-end justify-center" aria-hidden>
      <div className="box-rise relative h-[72%] w-[min(72%,300px)]">
        <div className="box-flap-left absolute left-0 top-0 h-6 w-1/2 rounded-tl-lg bg-[#b98a5a]" />
        <div className="box-flap-right absolute right-0 top-0 h-6 w-1/2 rounded-tr-lg bg-[#b98a5a]" />
        <div className="absolute inset-x-0 bottom-0 top-5 flex flex-col items-center justify-center rounded-b-2xl bg-gradient-to-b from-[#d4a574] to-[#b98a5a] shadow-xl">
          <span className="font-display text-2xl font-bold text-[#3b2a20]">Brew Lab</span>
          <span className="mt-1 text-xs font-semibold uppercase tracking-widest text-[#3b2a20]/70">Handle with love</span>
        </div>
      </div>
    </div>
  );
}

function Inspect({
  drink,
  selection,
  nutrition,
  saveDisabled,
}: {
  drink: DrinkConfig;
  selection: Selection;
  nutrition: ReturnType<typeof estimateNutrition>;
  saveDisabled: boolean;
}) {
  const lines = priceBreakdown(drink, selection);
  const unit = lines.reduce((sum, l) => sum + l.cents, 0);
  const stats: [string, string][] = [
    ["kcal", String(nutrition.calories)],
    ["sugar", `${nutrition.sugar}g`],
    ["fat", `${nutrition.fat}g`],
    ["protein", `${nutrition.protein}g`],
    ["caffeine", `${nutrition.caffeine}mg`],
  ];
  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold">Nutrition (estimated per cup)</h2>
        <dl className="mt-2 grid grid-cols-5 gap-1.5 text-center">
          {stats.map(([label, value]) => (
            <div key={label} className="rounded-xl bg-background px-1 py-2 ring-1 ring-line">
              <dd className="font-display text-sm font-semibold tabular-nums sm:text-base">{value}</dd>
              <dt className="text-[10px] uppercase tracking-wide text-muted">{label}</dt>
            </div>
          ))}
        </dl>
      </div>

      <CostBreakdown lines={lines} unit={unit} />
      <SaveRecipe slug={drink.slug} selection={selection} disabled={saveDisabled} />
    </div>
  );
}

/** Open on larger screens; collapsed on phones so the order button stays in view. */
function CostBreakdown({ lines, unit }: { lines: { label: string; cents: number }[]; unit: number }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- choose the default once we know the screen size
    setOpen(window.matchMedia("(min-width: 768px)").matches);
  }, []);
  return (
    <div className="rounded-xl ring-1 ring-line">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-3 py-2 text-sm font-semibold"
      >
        <span>Cost breakdown {open ? "▴" : "▾"}</span>
        <span className="tabular-nums">{formatCents(unit)}</span>
      </button>
      {open && (
        <ul className="space-y-1 border-t border-line px-3 py-2 text-sm">
          {lines.map((l) => (
            <li key={l.label} className="flex justify-between gap-3">
              <span className="text-muted">{l.label}</span>
              <span className="tabular-nums">{formatCents(l.cents)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SaveRecipe({ slug, selection, disabled }: { slug: string; selection: Selection; disabled: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("My coffee");
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  if (!open) {
    return (
      <div className="text-center">
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen(true)}
          className="w-full rounded-full px-5 py-3 text-sm font-medium ring-1 ring-line hover:ring-accent disabled:opacity-50"
        >
          ♡ Save this recipe
        </button>
        {message && (
          <p role="status" className="mt-2 text-sm text-accent">
            {message}
          </p>
        )}
      </div>
    );
  }
  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const result = await saveDrink({ slug, name, selection });
          if (result.ok) setMessage(`Saved as “${name.trim()}”.`);
          else if (result.signIn) return router.push(`/sign-in?next=${encodeURIComponent(window.location.pathname)}`);
          else setMessage(result.error);
          setOpen(false);
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
        className="min-w-0 flex-1 rounded-full bg-background px-4 py-2 text-sm outline-none ring-1 ring-line focus:ring-accent"
      />
      <button disabled={pending} className="rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50">
        {pending ? "Saving…" : "Save"}
      </button>
    </form>
  );
}

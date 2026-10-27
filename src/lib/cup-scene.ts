// What the Build Your Own cup should contain for a selection, and the ordered
// animation steps that take the cup from one state to the next. Pure logic,
// shared by the animated cup and its tests.

import type { Selection } from "./drink";

export type Band = { id: string; color: string; vol: number };
export type ToppingId = "whip" | "foam" | "drizzle" | "cinnamon";

export type SceneTarget = {
  iced: boolean;
  size: "small" | "medium" | "large";
  iceCount: number;
  /** Liquid layers, bottom to top, as fractions of the cup's height. */
  bands: Band[];
  /** Sweetener spoons/packets added. */
  sweet: number;
  toppings: Record<ToppingId, boolean>;
};

const ROAST: Record<string, string> = { "signature-roast": "#3b2214", "blonde-roast": "#6b3f1f", "decaf-roast": "#4f3020" };
export const MILK_COLORS: Record<string, string> = {
  "whole-milk": "#efe0c8",
  "skim-milk": "#f5ede1",
  "oat-milk": "#e4c99c",
  "almond-milk": "#eddbc0",
  "soy-milk": "#e9d6b2",
};
const SYRUPS: Record<string, string> = {
  "vanilla-syrup": "#f1dfa8",
  "caramel-syrup": "#c98a3d",
  "hazelnut-syrup": "#a0683a",
  "mocha-sauce": "#5a3220",
};
/** Hot water poured over espresso, as in an americano. */
const WATER = "#8b5e3c";
const FULL = 0.86;

export function sceneTarget(selection: Selection): SceneTarget {
  const has = (slug: string) => (selection[slug] ?? 0) > 0;
  const shots = selection["espresso-shot"] ?? 0;
  const roast = Object.keys(ROAST).find(has) ?? "signature-roast";
  const bands: Band[] = [];
  const espresso = Math.min(0.4, shots * 0.075);
  if (espresso > 0) bands.push({ id: "espresso", color: ROAST[roast], vol: espresso });
  for (const [slug, color] of Object.entries(SYRUPS)) {
    const pumps = selection[slug] ?? 0;
    if (pumps > 0) bands.push({ id: slug, color, vol: Math.min(0.08, pumps * 0.02) });
  }
  const milk = Object.keys(MILK_COLORS).find(has);
  if (milk) bands.push({ id: `milk:${milk}`, color: MILK_COLORS[milk], vol: Math.max(0, FULL - espresso) });
  else if (has("no-milk") && espresso > 0) bands.push({ id: "water", color: WATER, vol: Math.max(0, 0.8 - espresso) });

  const iced = has("iced");
  return {
    iced,
    size: has("large") ? "large" : has("medium") ? "medium" : "small",
    iceCount: !iced ? 0 : has("light-ice") ? 3 : has("extra-ice") ? 8 : 5,
    bands,
    sweet: ["sugar", "brown-sugar", "stevia"].reduce((n, s) => n + (selection[s] ?? 0), 0),
    toppings: {
      whip: has("whipped-cream"),
      foam: has("cold-foam"),
      drizzle: has("caramel-drizzle"),
      cinnamon: has("cinnamon"),
    },
  };
}

export type Step =
  | { kind: "cup"; iced: boolean; size: SceneTarget["size"] }
  | { kind: "ice"; to: number }
  | { kind: "pour"; id: string; color: string; to: number }
  | { kind: "drain"; id: string; to: number }
  | { kind: "mix"; duration: number }
  | { kind: "sprinkle" }
  | { kind: "topping"; id: ToppingId; on: boolean };

/** Durations in milliseconds, as approved: pours ~0.8–1.2 s, milk mixing 1.5 s, stir 0.6 s. */
export const DURATION = {
  cup: 250,
  icePerCube: 80,
  iceSettle: 450,
  pourMin: 800,
  pourMax: 1200,
  drain: 400,
  milkMix: 1500,
  stir: 600,
  sprinkle: 500,
  toppingOut: 300,
  topping: { whip: 1000, foam: 800, drizzle: 900, cinnamon: 800 } as Record<ToppingId, number>,
};

/** The animation steps, in order, that turn `from` into `to`. */
export function stepsBetween(from: SceneTarget, to: SceneTarget): Step[] {
  const steps: Step[] = [];
  if (from.iced !== to.iced || from.size !== to.size) steps.push({ kind: "cup", iced: to.iced, size: to.size });
  if (from.iceCount !== to.iceCount) steps.push({ kind: "ice", to: to.iceCount });

  const before = new Map(from.bands.map((b) => [b.id, b.vol]));
  const after = new Map(to.bands.map((b) => [b.id, b.vol]));
  // Drain what was removed or reduced first, then pour what is new or increased.
  for (const b of from.bands) {
    const next = after.get(b.id) ?? 0;
    if (next < b.vol - 0.001) steps.push({ kind: "drain", id: b.id, to: next });
  }
  let pouredMilk = false;
  for (const b of to.bands) {
    if (b.vol > (before.get(b.id) ?? 0) + 0.001) {
      steps.push({ kind: "pour", id: b.id, color: b.color, to: b.vol });
      if (b.id.startsWith("milk:")) pouredMilk = true;
    }
  }
  if (pouredMilk) steps.push({ kind: "mix", duration: DURATION.milkMix });

  if (to.sweet > from.sweet) steps.push({ kind: "sprinkle" });
  for (const id of ["whip", "foam", "drizzle", "cinnamon"] as ToppingId[]) {
    if (from.toppings[id] !== to.toppings[id]) steps.push({ kind: "topping", id, on: to.toppings[id] });
  }
  return steps;
}

export function stepDuration(step: Step, current: { vol: number; ice: number }) {
  switch (step.kind) {
    case "cup":
      return DURATION.cup;
    case "ice":
      return DURATION.iceSettle + DURATION.icePerCube * Math.max(0, step.to - current.ice);
    case "pour":
      return Math.min(DURATION.pourMax, DURATION.pourMin + (step.to - current.vol) * 600);
    case "drain":
      return DURATION.drain;
    case "mix":
      return step.duration;
    case "sprinkle":
      return DURATION.sprinkle;
    case "topping":
      return step.on ? DURATION.topping[step.id] : DURATION.toppingOut;
  }
}

/** Mixes colors weighted by volume. */
export function blendColors(parts: { color: string; weight: number }[]) {
  const total = parts.reduce((s, p) => s + p.weight, 0);
  if (total <= 0) return "#000000";
  const rgb = [0, 0, 0];
  for (const p of parts) {
    const n = parseInt(p.color.slice(1), 16);
    rgb[0] += ((n >> 16) & 255) * p.weight;
    rgb[1] += ((n >> 8) & 255) * p.weight;
    rgb[2] += (n & 255) * p.weight;
  }
  return `#${rgb.map((c) => Math.round(c / total).toString(16).padStart(2, "0")).join("")}`;
}

/** Linear blend between two hex colors (t = 0 → a, 1 → b). */
export function lerpColor(a: string, b: string, t: number) {
  return blendColors([
    { color: a, weight: 1 - t },
    { color: b, weight: t },
  ]);
}

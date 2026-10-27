// Estimated nutrition for a built drink, from typical values for each
// ingredient. Shown to customers as estimates, not lab-tested figures.

import { visibleGroups, type DrinkConfig, type Selection } from "./drink";

export type Nutrients = { calories: number; sugar: number; fat: number; protein: number; caffeine: number };

const zero = (): Nutrients => ({ calories: 0, sugar: 0, fat: 0, protein: 0, caffeine: 0 });

/** A full small (12 oz) cup's worth of each milk. */
const MILK: Record<string, Nutrients> = {
  "whole-milk": { calories: 150, sugar: 12, fat: 8, protein: 8, caffeine: 0 },
  "skim-milk": { calories: 90, sugar: 12, fat: 0.2, protein: 9, caffeine: 0 },
  "oat-milk": { calories: 130, sugar: 7, fat: 5, protein: 2, caffeine: 0 },
  "almond-milk": { calories: 60, sugar: 5, fat: 2.5, protein: 1, caffeine: 0 },
  "soy-milk": { calories: 110, sugar: 8, fat: 4, protein: 7, caffeine: 0 },
};

/** Per unit: one shot, one pump, one packet or one serving of a topping. */
const PER_UNIT: Record<string, Nutrients> = {
  "espresso-shot": { calories: 3, sugar: 0, fat: 0, protein: 0.1, caffeine: 75 },
  "vanilla-syrup": { calories: 20, sugar: 5, fat: 0, protein: 0, caffeine: 0 },
  "caramel-syrup": { calories: 20, sugar: 5, fat: 0, protein: 0, caffeine: 0 },
  "hazelnut-syrup": { calories: 20, sugar: 5, fat: 0, protein: 0, caffeine: 0 },
  "mocha-sauce": { calories: 25, sugar: 4.5, fat: 0.5, protein: 0.3, caffeine: 5 },
  sugar: { calories: 15, sugar: 4, fat: 0, protein: 0, caffeine: 0 },
  "brown-sugar": { calories: 15, sugar: 4, fat: 0, protein: 0, caffeine: 0 },
  stevia: zero(),
  "whipped-cream": { calories: 80, sugar: 5, fat: 7, protein: 0.5, caffeine: 0 },
  "cold-foam": { calories: 70, sugar: 7, fat: 4.5, protein: 1, caffeine: 0 },
  "caramel-drizzle": { calories: 30, sugar: 5, fat: 1, protein: 0, caffeine: 0 },
  cinnamon: { calories: 1, sugar: 0, fat: 0, protein: 0, caffeine: 0 },
};

/** How much of the cup is milk in each drink (the rest is coffee, water, ice or foam). */
const MILK_SHARE: Record<string, number> = {
  latte: 1,
  "caramel-macchiato": 1,
  mocha: 0.9,
  cappuccino: 0.65,
  "flat-white": 0.6,
  "build-your-own": 0.8,
  americano: 0.2,
  espresso: 0.1,
  "cold-brew": 0.3,
  "vanilla-cream-cold-brew": 0.3,
};

/** Brewed coffee that isn't espresso shots (cold brew), per small cup. */
const BASE: Record<string, Nutrients> = {
  "cold-brew": { calories: 5, sugar: 0, fat: 0, protein: 0.3, caffeine: 150 },
  "vanilla-cream-cold-brew": { calories: 5, sugar: 0, fat: 0, protein: 0.3, caffeine: 150 },
};

const SIZE_FACTOR: Record<string, number> = { small: 1, medium: 1.33, large: 1.67 };
const ROAST_CAFFEINE: Record<string, number> = { "signature-roast": 1, "blonde-roast": 1.1, "decaf-roast": 0.05 };

function add(total: Nutrients, part: Nutrients, times = 1) {
  for (const k of Object.keys(total) as (keyof Nutrients)[]) total[k] += part[k] * times;
}

export function estimateNutrition(drink: DrinkConfig, selection: Selection): Nutrients {
  const has = (slug: string) => (selection[slug] ?? 0) > 0;
  const visible = new Set(visibleGroups(drink, selection).flatMap((g) => g.options.map((o) => o.slug)));
  const size = Object.keys(SIZE_FACTOR).find(has) ?? "small";
  const sizeFactor = SIZE_FACTOR[size];
  // Iced drinks hold less liquid: ice takes about a quarter of the cup.
  const liquid = has("iced") ? sizeFactor * 0.75 : sizeFactor;
  const total = zero();

  if (BASE[drink.slug]) add(total, BASE[drink.slug], liquid);
  const milk = Object.keys(MILK).find((m) => has(m) && visible.has(m));
  if (milk) add(total, MILK[milk], liquid * (MILK_SHARE[drink.slug] ?? 0.8));

  for (const [slug, qty] of Object.entries(selection)) {
    if (PER_UNIT[slug] && visible.has(slug)) add(total, PER_UNIT[slug], qty);
  }

  const roast = Object.keys(ROAST_CAFFEINE).find(has);
  if (roast) total.caffeine *= ROAST_CAFFEINE[roast];

  return {
    calories: Math.round(total.calories),
    sugar: Math.round(total.sugar),
    fat: Math.round(total.fat * 10) / 10,
    protein: Math.round(total.protein),
    caffeine: Math.round(total.caffeine),
  };
}

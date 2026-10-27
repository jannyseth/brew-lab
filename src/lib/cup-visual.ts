// Turns a drink selection into what the cup illustration shows. Shared by the
// builder's live cup and the menu cards, so both always agree.

import type { DrinkConfig, Selection } from "./drink";

export type CupVisual = {
  size: "small" | "medium" | "large";
  /** A small espresso cup, for drinks that come in one size (e.g. espresso). */
  demitasse: boolean;
  iced: boolean;
  ice: "light" | "regular" | "extra" | null;
  shots: number;
  roast: "signature" | "blonde" | "decaf";
  /** Brewed coffee instead of espresso (cold brew). */
  brewed: boolean;
  milk: string | null;
  syrups: string[];
  sweetened: boolean;
  whip: boolean;
  foam: boolean;
  drizzle: boolean;
  cinnamon: boolean;
};

export function cupVisual(drink: Pick<DrinkConfig, "slug" | "groups">, selection: Selection): CupVisual {
  const has = (slug: string) => (selection[slug] ?? 0) > 0;
  const hasMilkGroup = drink.groups.some((g) => g.slug === "milk");
  const milk = hasMilkGroup ? (["whole-milk", "skim-milk", "oat-milk", "almond-milk", "soy-milk"].find(has) ?? null) : null;
  return {
    size: has("large") ? "large" : has("medium") ? "medium" : "small",
    demitasse: !drink.groups.some((g) => g.slug === "size"),
    iced: has("iced"),
    ice: has("iced") ? (has("light-ice") ? "light" : has("extra-ice") ? "extra" : "regular") : null,
    shots: selection["espresso-shot"] ?? 0,
    roast: has("blonde-roast") ? "blonde" : has("decaf-roast") ? "decaf" : "signature",
    brewed: drink.slug.includes("cold-brew"),
    milk,
    syrups: ["vanilla-syrup", "caramel-syrup", "hazelnut-syrup", "mocha-sauce"].filter(has),
    sweetened: ["sugar", "brown-sugar", "stevia"].some(has),
    whip: has("whipped-cream"),
    foam: has("cold-foam"),
    drizzle: has("caramel-drizzle"),
    cinnamon: has("cinnamon"),
  };
}

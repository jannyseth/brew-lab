import { describe, expect, it } from "vitest";
import type { DrinkConfig } from "./drink";
import { estimateNutrition } from "./nutrition";

const group = (slug: string, options: string[], requiresOptionSlug: string | null = null) => ({
  slug,
  name: slug,
  selection: "multi" as const,
  minSelected: 0,
  maxSelected: 4,
  requiresOptionSlug,
  options: options.map((o) => ({ slug: o, name: o, priceDeltaCents: 0, maxQuantity: 6 })),
});

const latte: DrinkConfig = {
  slug: "latte",
  name: "Latte",
  description: "",
  basePriceCents: 0,
  isCustom: false,
  defaults: {},
  groups: [
    group("size", ["small", "medium", "large"]),
    group("temperature", ["hot", "iced"]),
    group("shots", ["espresso-shot"]),
    group("milk", ["whole-milk", "oat-milk", "no-milk"]),
    group("syrups", ["vanilla-syrup"]),
    group("toppings", ["whipped-cream"]),
  ],
};

describe("estimateNutrition", () => {
  it("adds milk, shots and syrup for a small hot latte", () => {
    const n = estimateNutrition(latte, { small: 1, hot: 1, "espresso-shot": 2, "whole-milk": 1, "vanilla-syrup": 2 });
    expect(n).toEqual({ calories: 196, sugar: 22, fat: 8, protein: 8, caffeine: 150 });
  });

  it("scales milk with size and shrinks it for ice", () => {
    const hot = estimateNutrition(latte, { large: 1, hot: 1, "whole-milk": 1 });
    const iced = estimateNutrition(latte, { large: 1, iced: 1, "whole-milk": 1 });
    expect(hot.calories).toBe(251);
    expect(iced.calories).toBeLessThan(hot.calories);
  });

  it("is near zero for black coffee", () => {
    const n = estimateNutrition(latte, { small: 1, hot: 1, "espresso-shot": 2, "no-milk": 1 });
    expect(n.calories).toBe(6);
    expect(n.sugar).toBe(0);
  });
});

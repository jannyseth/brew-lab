import { describe, expect, it } from "vitest";
import {
  describeSelection,
  initialSelection,
  normalizeSelection,
  priceBreakdown,
  priceDrink,
  type DrinkConfig,
} from "./drink";

const latte: DrinkConfig = {
  slug: "latte",
  name: "Latte",
  description: "",
  basePriceCents: 425,
  isCustom: false,
  defaults: { medium: 1, hot: 1, "espresso-shot": 2, "vanilla-syrup": 2 },
  groups: [
    {
      slug: "size",
      name: "Size",
      selection: "single",
      minSelected: 1,
      maxSelected: 1,
      requiresOptionSlug: null,
      options: [
        { slug: "small", name: "Small", priceDeltaCents: 0, maxQuantity: 1 },
        { slug: "medium", name: "Medium", priceDeltaCents: 50, maxQuantity: 1 },
      ],
    },
    {
      slug: "temperature",
      name: "Temperature",
      selection: "single",
      minSelected: 1,
      maxSelected: 1,
      requiresOptionSlug: null,
      options: [
        { slug: "hot", name: "Hot", priceDeltaCents: 0, maxQuantity: 1 },
        { slug: "iced", name: "Iced", priceDeltaCents: 0, maxQuantity: 1 },
      ],
    },
    {
      slug: "ice",
      name: "Ice level",
      selection: "single",
      minSelected: 1,
      maxSelected: 1,
      requiresOptionSlug: "iced",
      options: [
        { slug: "light-ice", name: "Light ice", priceDeltaCents: 0, maxQuantity: 1 },
        { slug: "regular-ice", name: "Regular ice", priceDeltaCents: 0, maxQuantity: 1 },
      ],
    },
    {
      slug: "shots",
      name: "Espresso shots",
      selection: "multi",
      minSelected: 0,
      maxSelected: 1,
      requiresOptionSlug: null,
      options: [{ slug: "espresso-shot", name: "Espresso shot", priceDeltaCents: 100, maxQuantity: 6 }],
    },
    {
      slug: "syrups",
      name: "Syrups",
      selection: "multi",
      minSelected: 0,
      maxSelected: 2,
      requiresOptionSlug: null,
      options: [
        { slug: "vanilla-syrup", name: "Vanilla", priceDeltaCents: 25, maxQuantity: 6 },
        { slug: "caramel-syrup", name: "Caramel", priceDeltaCents: 25, maxQuantity: 6 },
        { slug: "hazelnut-syrup", name: "Hazelnut", priceDeltaCents: 25, maxQuantity: 6 },
      ],
    },
  ],
};

describe("priceDrink", () => {
  it("prices the default recipe without charging included extras", () => {
    expect(priceDrink(latte, initialSelection(latte))).toEqual({ ok: true, totalCents: 475 });
  });

  it("charges only quantity above the recipe", () => {
    const result = priceDrink(latte, { medium: 1, hot: 1, "espresso-shot": 3, "vanilla-syrup": 1 });
    expect(result).toEqual({ ok: true, totalCents: 575 });
  });

  it("rejects unknown options and bad quantities", () => {
    const result = priceDrink(latte, { medium: 1, hot: 1, gold: 1, "espresso-shot": 0.5 });
    expect(result.ok).toBe(false);
  });

  it("rejects options from a hidden group", () => {
    expect(priceDrink(latte, { medium: 1, hot: 1, "light-ice": 1 }).ok).toBe(false);
  });

  it("requires the ice level once iced is chosen", () => {
    expect(priceDrink(latte, { medium: 1, iced: 1 }).ok).toBe(false);
    expect(priceDrink(latte, { medium: 1, iced: 1, "light-ice": 1 }).ok).toBe(true);
  });

  it("enforces quantity and group limits", () => {
    expect(priceDrink(latte, { medium: 1, hot: 1, "espresso-shot": 7 }).ok).toBe(false);
    expect(priceDrink(latte, { medium: 1, small: 1, hot: 1 }).ok).toBe(false);
    const threeSyrups = { medium: 1, hot: 1, "vanilla-syrup": 1, "caramel-syrup": 1, "hazelnut-syrup": 1 };
    expect(priceDrink(latte, threeSyrups).ok).toBe(false);
  });
});

describe("normalizeSelection", () => {
  it("drops hidden-group options and clamps quantities", () => {
    expect(normalizeSelection(latte, { medium: 1, hot: 1, "light-ice": 1, "espresso-shot": 9 })).toEqual({
      medium: 1,
      hot: 1,
      "espresso-shot": 6,
    });
  });
});

describe("describeSelection", () => {
  it("lists choices in group order", () => {
    expect(describeSelection(latte, initialSelection(latte))).toEqual([
      "Medium",
      "Hot",
      "2 × Espresso shot",
      "2 × Vanilla",
    ]);
  });
});

describe("priceBreakdown", () => {
  it("lists the base and each extra, adding up to the price", () => {
    const selection = { medium: 1, hot: 1, "espresso-shot": 3, "vanilla-syrup": 4 };
    const lines = priceBreakdown(latte, selection);
    expect(lines).toEqual([
      { label: "Latte", cents: 425 },
      { label: "Medium", cents: 50 },
      { label: "Espresso shot", cents: 100 },
      { label: "2 × Vanilla", cents: 50 },
    ]);
    const price = priceDrink(latte, selection);
    expect(price.ok && price.totalCents).toBe(lines.reduce((sum, l) => sum + l.cents, 0));
  });
});

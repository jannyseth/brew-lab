import { describe, expect, it } from "vitest";
import { blendColors, sceneTarget, stepsBetween } from "./cup-scene";

const empty = sceneTarget({});

describe("sceneTarget", () => {
  it("is an empty cup with nothing selected", () => {
    expect(empty.bands).toEqual([]);
    expect(empty.iceCount).toBe(0);
  });

  it("stacks espresso, syrups and milk, and settles ice for iced drinks", () => {
    const t = sceneTarget({ medium: 1, iced: 1, "extra-ice": 1, "blonde-roast": 1, "espresso-shot": 2, "caramel-syrup": 2, "oat-milk": 1 });
    expect(t.iceCount).toBe(8);
    expect(t.bands.map((b) => b.id)).toEqual(["espresso", "caramel-syrup", "milk:oat-milk"]);
    expect(t.bands[2].vol).toBeCloseTo(0.86 - 0.15);
  });

  it("tops up with water when there's no milk", () => {
    const t = sceneTarget({ hot: 1, "espresso-shot": 1, "no-milk": 1 });
    expect(t.bands.map((b) => b.id)).toEqual(["espresso", "water"]);
  });
});

describe("stepsBetween", () => {
  it("drops ice, pours espresso, then pours and mixes milk, in that order", () => {
    const to = sceneTarget({ small: 1, iced: 1, "regular-ice": 1, "espresso-shot": 1, "whole-milk": 1 });
    expect(stepsBetween(empty, to).map((s) => s.kind)).toEqual(["cup", "ice", "pour", "pour", "mix"]);
  });

  it("drains the old milk before pouring a new one", () => {
    const a = sceneTarget({ "espresso-shot": 1, "whole-milk": 1 });
    const b = sceneTarget({ "espresso-shot": 1, "oat-milk": 1 });
    const steps = stepsBetween(a, b);
    expect(steps[0]).toMatchObject({ kind: "drain", id: "milk:whole-milk", to: 0 });
    expect(steps[1]).toMatchObject({ kind: "pour", id: "milk:oat-milk" });
    expect(steps.at(-1)).toMatchObject({ kind: "mix" });
  });

  it("prepares each topping that is added and removes those taken off", () => {
    const a = sceneTarget({ "whipped-cream": 1 });
    const b = sceneTarget({ "caramel-drizzle": 1, cinnamon: 1 });
    expect(stepsBetween(a, b)).toEqual([
      { kind: "topping", id: "whip", on: false },
      { kind: "topping", id: "drizzle", on: true },
      { kind: "topping", id: "cinnamon", on: true },
    ]);
  });
});

describe("blendColors", () => {
  it("averages by weight", () => {
    expect(blendColors([{ color: "#000000", weight: 1 }, { color: "#ffffff", weight: 1 }])).toBe("#808080");
  });
});

import { describe, expect, it } from "vitest";
import { creatorCredit, currentTier, nextTierGoal, signatureSlug, tierForBuyers } from "./coin-rules";

describe("tiers", () => {
  it("uses distinct buyers per quarter", () => {
    expect(tierForBuyers(0)).toBe("creator");
    expect(tierForBuyers(25)).toBe("gold");
    expect(tierForBuyers(75)).toBe("platinum");
  });

  it("drops only one tier after a slow quarter", () => {
    expect(currentTier(3, 80)).toBe("gold");
    expect(currentTier(3, 30)).toBe("creator");
    expect(currentTier(80, 0)).toBe("platinum");
  });

  it("shows how many more buyers are needed", () => {
    expect(nextTierGoal(10)).toEqual({ tier: "gold", needed: 15 });
    expect(nextTierGoal(70)).toEqual({ tier: "platinum", needed: 5 });
    expect(nextTierGoal(75)).toBeNull();
  });
});

describe("creatorCredit", () => {
  const base = { tier: "creator" as const, earnedToday: 0, earnedThisMonth: 0, creditsFromBuyerToday: 0, creditsFromBuyerThisMonth: 0 };

  it("pays the normal rate, and more for Platinum", () => {
    expect(creatorCredit(base)).toBe(10);
    expect(creatorCredit({ ...base, tier: "platinum" })).toBe(15);
  });

  it("pays a buyer's orders once per day and four times per month", () => {
    expect(creatorCredit({ ...base, creditsFromBuyerToday: 1 })).toBe(0);
    expect(creatorCredit({ ...base, creditsFromBuyerThisMonth: 4 })).toBe(0);
  });

  it("stops at the daily and monthly caps", () => {
    expect(creatorCredit({ ...base, earnedToday: 295 })).toBe(5);
    expect(creatorCredit({ ...base, earnedThisMonth: 1500 })).toBe(0);
    expect(creatorCredit({ ...base, tier: "platinum", earnedThisMonth: 1500 })).toBe(15);
  });
});

describe("signatureSlug", () => {
  it("makes a readable link", () => {
    expect(signatureSlug("Jan's Caramel Cloud!", "ab12c")).toBe("jan-s-caramel-cloud-ab12c");
    expect(signatureSlug("☕", "ab12c")).toBe("drink-ab12c");
  });
});

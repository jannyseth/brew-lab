// Bean coin and creator tier rules, shared by the server and the pages that
// explain them. Starting values come from the v2 research report; tune them
// after a quarter of real data, but never raise FREE_DRINK_COINS once launched.

/** Earned by the buyer for every paid, completed order (15 orders = 1 free drink). */
export const PURCHASE_COINS = 10;
/** Earned by a creator each time another customer's completed order includes their drink. */
export const CREATOR_COINS = 10;
/** Cost of one free drink (the most expensive drink in the order). */
export const FREE_DRINK_COINS = 150;
/** Earned coins wait this long before they can be spent, so refunds can still be undone. */
export const HOLD_DAYS = 7;

// Abuse limits on creator earnings.
/** One credit per buyer per creator per day, and at most this many per month. */
export const MAX_CREDITS_PER_BUYER_PER_MONTH = 4;
export const CREATOR_DAILY_CAP = 300;
export const CREATOR_MONTHLY_CAP = 1500;
export const PLATINUM_MONTHLY_CAP = 3000;

export type Tier = "creator" | "gold" | "platinum";

/** Distinct buyers of a creator's drinks in one quarter needed for each tier. */
export const TIER_THRESHOLDS = { gold: 25, platinum: 75 } as const;

export const tierLabels: Record<Tier, string> = { creator: "Creator", gold: "Gold", platinum: "Platinum" };

const rank: Tier[] = ["creator", "gold", "platinum"];

export function tierForBuyers(buyers: number): Tier {
  if (buyers >= TIER_THRESHOLDS.platinum) return "platinum";
  if (buyers >= TIER_THRESHOLDS.gold) return "gold";
  return "creator";
}

/**
 * Tiers are earned per quarter. A creator who misses the bar drops only one
 * tier for the next quarter (a "soft landing"), not straight to the bottom.
 */
export function currentTier(buyersThisQuarter: number, buyersLastQuarter: number): Tier {
  const earned = rank.indexOf(tierForBuyers(buyersThisQuarter));
  const kept = Math.max(0, rank.indexOf(tierForBuyers(buyersLastQuarter)) - 1);
  return rank[Math.max(earned, kept)];
}

/** Buyers still needed this quarter to reach (or keep) the next tier up, or null at the top. */
export function nextTierGoal(buyersThisQuarter: number): { tier: Tier; needed: number } | null {
  if (buyersThisQuarter < TIER_THRESHOLDS.gold) return { tier: "gold", needed: TIER_THRESHOLDS.gold - buyersThisQuarter };
  if (buyersThisQuarter < TIER_THRESHOLDS.platinum) {
    return { tier: "platinum", needed: TIER_THRESHOLDS.platinum - buyersThisQuarter };
  }
  return null;
}

/** Platinum creators earn 1.5x per order and have a higher monthly cap. */
export function creatorEarnFor(tier: Tier) {
  return tier === "platinum"
    ? { perOrder: Math.round(CREATOR_COINS * 1.5), monthlyCap: PLATINUM_MONTHLY_CAP }
    : { perOrder: CREATOR_COINS, monthlyCap: CREATOR_MONTHLY_CAP };
}

/** Limits how much a creator can earn from one order, given what they already earned. */
export function creatorCredit(input: {
  tier: Tier;
  earnedToday: number;
  earnedThisMonth: number;
  creditsFromBuyerToday: number;
  creditsFromBuyerThisMonth: number;
}): number {
  const { perOrder, monthlyCap } = creatorEarnFor(input.tier);
  if (input.creditsFromBuyerToday > 0) return 0;
  if (input.creditsFromBuyerThisMonth >= MAX_CREDITS_PER_BUYER_PER_MONTH) return 0;
  const room = Math.min(CREATOR_DAILY_CAP - input.earnedToday, monthlyCap - input.earnedThisMonth);
  return Math.max(0, Math.min(perOrder, room));
}

/** URL-safe slug for a signature drink's share link, with a short random suffix. */
export function signatureSlug(name: string, random = Math.random().toString(36).slice(2, 7)) {
  const base = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return `${base || "drink"}-${random}`;
}

/** Public creator names: 3-20 letters, numbers, dots or underscores. */
export const HANDLE_PATTERN = /^[a-zA-Z0-9._]{3,20}$/;

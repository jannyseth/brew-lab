import { tierLabels, type Tier } from "@/lib/coin-rules";

const styles: Record<Tier, string> = {
  creator: "bg-accent-soft text-foreground",
  gold: "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200",
  platinum: "bg-gradient-to-r from-slate-200 to-sky-100 text-slate-900 ring-1 ring-slate-300 dark:from-slate-600 dark:to-sky-900 dark:text-white dark:ring-slate-500",
};

/** Creator status shown next to a creator's name. */
export function TierBadge({ tier }: { tier: Tier }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${styles[tier]}`}>
      {tier === "platinum" && <span aria-hidden>◆</span>}
      {tierLabels[tier]}
    </span>
  );
}

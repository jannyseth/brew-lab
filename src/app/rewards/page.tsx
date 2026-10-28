import type { Metadata } from "next";
import { desc, eq } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/db";
import { creatorProfiles, signatureDrinks } from "@/db/schema";
import { ShareButtons } from "@/components/share-buttons";
import { TierBadge } from "@/components/tier-badge";
import { Badge, cardClass, formatDate, PageTitle } from "@/components/ui";
import {
  CREATOR_COINS,
  FREE_DRINK_COINS,
  HOLD_DAYS,
  nextTierGoal,
  PURCHASE_COINS,
  tierLabels,
  TIER_THRESHOLDS,
} from "@/lib/coin-rules";
import { coinBalance, coinHistory, creatorTier, signatureDrinkStats } from "@/lib/coins";
import { requireRole } from "@/lib/session";
import { CreatorSettings } from "./creator-settings";

export const metadata: Metadata = { title: "Rewards" };

const kindLabels = { purchase: "Order", creator: "Your signature drink", redeem: "Free drink", refund: "Refund", adjust: "Adjustment" };

export default async function RewardsPage({ searchParams }: PageProps<"/rewards">) {
  const user = await requireRole(["customer"], "/rewards");
  const { submitted } = await searchParams;

  const [balance, history, tier, [profile], drinks] = await Promise.all([
    coinBalance(user.id),
    coinHistory(user.id),
    creatorTier(user.id),
    db.select().from(creatorProfiles).where(eq(creatorProfiles.userId, user.id)),
    db.select().from(signatureDrinks).where(eq(signatureDrinks.creatorId, user.id)).orderBy(desc(signatureDrinks.createdAt)),
  ]);
  const stats = await signatureDrinkStats(drinks.map((d) => d.id));
  const goal = nextTierGoal(tier.buyersThisQuarter);
  const progress = Math.min(100, Math.round((balance.spendable / FREE_DRINK_COINS) * 100));

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <PageTitle title="Rewards" subtitle="Bean coins, your signature drinks and your creator status." />
      {submitted && (
        <p className="mb-6 rounded-2xl bg-accent-soft px-4 py-3 text-sm">
          Your drink was sent for review. It goes public, with its share link, once the Brew Lab team approves it.
        </p>
      )}

      <section className={cardClass}>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm text-muted">Bean coins you can spend</p>
            <p className="font-display text-4xl font-semibold tabular-nums">{balance.spendable}</p>
            {balance.pending > 0 && (
              <p className="text-sm text-muted">+{balance.pending} on hold (spendable {HOLD_DAYS} days after each pickup)</p>
            )}
          </div>
          <p className="text-sm text-muted">{FREE_DRINK_COINS} coins = 1 free drink of your choice</p>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full rounded-full bg-accent" style={{ width: `${progress}%` }} />
        </div>
        <p className="mt-2 text-sm">
          {balance.spendable >= FREE_DRINK_COINS
            ? "You have a free drink waiting. Tick “Use bean coins” at checkout."
            : `${FREE_DRINK_COINS - balance.spendable} more coins to your next free drink.`}
        </p>
      </section>

      <section className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-3">
        {[
          { title: `${PURCHASE_COINS} coins`, body: "for every order you pick up" },
          { title: `${CREATOR_COINS} coins`, body: "each time someone else orders your signature drink" },
          { title: `${FREE_DRINK_COINS} coins`, body: "buy any drink on the menu" },
        ].map((s) => (
          <div key={s.title} className="rounded-2xl bg-accent-soft p-4">
            <p className="font-semibold">{s.title}</p>
            <p className="text-sm text-muted">{s.body}</p>
          </div>
        ))}
      </section>

      <section className="mt-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Creator status</h2>
          <TierBadge tier={tier.tier} />
        </div>
        <p className="mt-2 text-sm text-muted">
          {tier.buyersThisQuarter} different customers ordered your drinks this quarter.{" "}
          {goal ? `${goal.needed} more to reach ${tierLabels[goal.tier]}.` : "You're at the top. Keep it up to stay Platinum next quarter."}
        </p>
        <p className="mt-1 text-xs text-muted">
          Gold: {TIER_THRESHOLDS.gold} customers a quarter · Platinum: {TIER_THRESHOLDS.platinum} customers a quarter, 1.5× coins per order.
          Status resets each quarter; if you fall short you drop one level, not to the bottom.
        </p>
      </section>

      <section className="mt-10">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Your signature drinks</h2>
          <Link href="/saved" className="text-sm font-medium text-accent hover:underline">
            Publish a saved drink →
          </Link>
        </div>
        {drinks.length === 0 ? (
          <div className={cardClass}>
            <p>You haven&apos;t published a drink yet.</p>
            <p className="mt-1 text-sm text-muted">
              Build a drink, save it, then tap <span className="font-medium">Publish as signature drink</span> on your Saved page.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {drinks.map((d) => {
              const s = stats.get(d.id)!;
              return (
                <li key={d.id} className={cardClass}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="font-display text-xl font-semibold">{d.name}</p>
                    <Badge status={d.status === "approved" ? "active" : d.status} />
                  </div>
                  {d.status === "approved" ? (
                    <>
                      <p className="mt-1 text-sm text-muted tabular-nums">
                        {s.buyers} customers · {s.orders} orders · {s.coins} coins earned
                      </p>
                      <div className="mt-4">
                        <ShareButtons path={`/d/${d.slug}`} title={`${d.name} at Brew Lab`} />
                      </div>
                      <Link href={`/d/${d.slug}`} className="mt-3 inline-block text-sm text-accent hover:underline">
                        Open the drink page
                      </Link>
                    </>
                  ) : d.status === "pending" ? (
                    <p className="mt-1 text-sm text-muted">Waiting for review. Submitted {formatDate(d.createdAt)}.</p>
                  ) : (
                    <p className="mt-1 text-sm text-muted">Not approved{d.reviewNote ? `: ${d.reviewNote}` : "."}</p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {profile && (
          <div className="mt-6">
            <CreatorSettings handle={profile.handle} showOnLeaderboard={profile.showOnLeaderboard} />
          </div>
        )}
        <Link href="/leaderboard" className="mt-6 inline-block text-sm font-medium text-accent hover:underline">
          See this week&apos;s top drinks →
        </Link>
      </section>

      <section className="mt-10">
        <h2 className="mb-4 text-lg font-semibold">Coin history</h2>
        {history.length === 0 ? (
          <p className="text-muted">No coins yet. You earn {PURCHASE_COINS} with every order you pick up.</p>
        ) : (
          <ul className="divide-y divide-line rounded-2xl border border-line bg-card text-sm">
            {history.map((e) => (
              <li key={e.id} className={`flex justify-between gap-4 px-4 py-3 ${e.voidedAt ? "opacity-50" : ""}`}>
                <span>
                  <span className="font-medium">{kindLabels[e.kind]}</span>
                  <span className="block text-muted">
                    {e.note} · {formatDate(e.createdAt)}
                    {e.voidedAt ? " · cancelled" : e.amount > 0 && e.availableAt > new Date() ? ` · spendable ${formatDate(e.availableAt)}` : ""}
                  </span>
                </span>
                <span className={`tabular-nums font-medium ${e.amount < 0 ? "" : "text-accent"}`}>
                  {e.amount > 0 ? `+${e.amount}` : e.amount}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-4 text-xs text-muted">
          Bean coins have no cash value and can&apos;t be transferred or sold. See the{" "}
          <Link href="/terms#bean-coins" className="hover:text-accent">
            bean coin terms
          </Link>
          .
        </p>
      </section>
    </div>
  );
}

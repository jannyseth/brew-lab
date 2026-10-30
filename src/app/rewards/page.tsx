import type { Metadata } from "next";
import { desc, eq } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/db";
import { creatorProfiles, menuItems, savedDrinks, signatureDrinks } from "@/db/schema";
import { ShareButtons } from "@/components/share-buttons";
import { TierBadge } from "@/components/tier-badge";
import { Badge, cardClass, formatDate, PageTitle } from "@/components/ui";
import { CREATOR_COINS, FREE_DRINK_COINS, HOLD_DAYS, PURCHASE_COINS } from "@/lib/coin-rules";
import { coinBalance, coinHistory, creatorTier, signatureDrinkStats } from "@/lib/coins";
import { describeSelection, formatCents, priceDrink } from "@/lib/drink";
import { getDrink } from "@/lib/menu";
import { requireRole } from "@/lib/session";
import { leaderboard } from "@/lib/signature";
import { CreatorSettings } from "./creator-settings";
import { SavedDrinkActions } from "./saved-drink-actions";

export const metadata: Metadata = { title: "Saved & rewards" };

const kindLabels = { purchase: "Order", creator: "Your signature drink", redeem: "Free drink", refund: "Refund", adjust: "Adjustment" };

export default async function RewardsPage({ searchParams }: PageProps<"/rewards">) {
  const user = await requireRole(["customer"], "/rewards");
  const { submitted } = await searchParams;

  const [balance, history, tier, [profile], drinks, saved, top] = await Promise.all([
    coinBalance(user.id),
    coinHistory(user.id),
    creatorTier(user.id),
    db.select().from(creatorProfiles).where(eq(creatorProfiles.userId, user.id)),
    db.select().from(signatureDrinks).where(eq(signatureDrinks.creatorId, user.id)).orderBy(desc(signatureDrinks.createdAt)),
    db
      .select({ id: savedDrinks.id, name: savedDrinks.name, selection: savedDrinks.selection, slug: menuItems.slug })
      .from(savedDrinks)
      .innerJoin(menuItems, eq(savedDrinks.menuItemId, menuItems.id))
      .where(eq(savedDrinks.userId, user.id))
      .orderBy(desc(savedDrinks.createdAt)),
    leaderboard("week", 3),
  ]);
  const stats = await signatureDrinkStats(drinks.map((d) => d.id));
  // Re-price saved recipes with today's menu; one may no longer be valid.
  const savedRows = await Promise.all(
    saved.map(async (row) => {
      const drink = await getDrink(row.slug);
      const price = drink ? priceDrink(drink, row.selection) : null;
      return {
        ...row,
        drinkName: drink?.name ?? "No longer available",
        summary: drink ? describeSelection(drink, row.selection).join(" · ") : "",
        priceCents: price?.ok ? price.totalCents : null,
      };
    }),
  );
  const progress = Math.min(100, Math.round((balance.spendable / FREE_DRINK_COINS) * 100));

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <PageTitle title="Saved & rewards" />
      {submitted && (
        <p className="mb-6 rounded-2xl bg-accent-soft px-4 py-3 text-sm">Sent for review. It goes public once approved.</p>
      )}

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-2">
        <section className={cardClass}>
          <p className="text-sm text-muted">Bean coins</p>
          <p className="font-display text-4xl font-semibold tabular-nums">{balance.spendable}</p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label="Progress to a free drink">
            <div className="h-full rounded-full bg-accent" style={{ width: `${progress}%` }} />
          </div>
          <p className="mt-2 text-sm">
            {balance.spendable >= FREE_DRINK_COINS
              ? "🎉 Free drink ready. Use it at checkout."
              : `${FREE_DRINK_COINS - balance.spendable} to a free drink`}
          </p>
          {balance.pending > 0 && <p className="text-xs text-muted">+{balance.pending} on hold</p>}
        </section>

        <section className={cardClass}>
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted">Top drinks this week</p>
            <Link href="/leaderboard" className="text-xs font-medium text-accent hover:underline">
              See all
            </Link>
          </div>
          {top.length === 0 ? (
            <p className="mt-3 text-sm">None yet. Yours could be first.</p>
          ) : (
            <ol className="mt-2 space-y-2">
              {top.map((r, i) => (
                <li key={r.id} className="flex items-center gap-3">
                  <span className={`w-5 font-display text-lg font-semibold ${i === 0 ? "text-accent" : "text-muted"}`}>{i + 1}</span>
                  <Link href={`/d/${r.slug}`} className="min-w-0 flex-1 truncate font-medium hover:text-accent">
                    {r.name}
                  </Link>
                  <span className="text-xs text-muted tabular-nums">{r.buyers}</span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      <section id="saved" className="mt-10 scroll-mt-24">
        <h2 className="mb-3 text-lg font-semibold">Saved drinks</h2>
        {savedRows.length === 0 ? (
          <div className={cardClass}>
            <p className="text-sm">Nothing saved yet.</p>
            <Link href="/menu/build-your-own" className="mt-2 inline-block text-sm font-medium text-accent">
              Build your own →
            </Link>
          </div>
        ) : (
          <ul className="space-y-3">
            {savedRows.map((d) => (
              <li key={d.id} className={cardClass}>
                <div className="flex items-baseline justify-between gap-4">
                  <p className="font-semibold">{d.name}</p>
                  {d.priceCents !== null && <span className="tabular-nums">{formatCents(d.priceCents)}</span>}
                </div>
                <p className="line-clamp-1 text-xs text-muted">{d.summary || d.drinkName}</p>
                <SavedDrinkActions
                  id={d.id}
                  slug={d.slug}
                  drinkName={d.drinkName}
                  summary={d.summary}
                  selection={d.selection}
                  priceCents={d.priceCents}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Your signature drinks</h2>
          <TierBadge tier={tier.tier} />
        </div>
        {drinks.length === 0 ? (
          <p className="text-sm text-muted">Publish a saved drink. You get {CREATOR_COINS} coins each time someone orders it.</p>
        ) : (
          <ul className="space-y-3">
            {drinks.map((d) => {
              const s = stats.get(d.id)!;
              return (
                <li key={d.id} className={cardClass}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <Link href={`/d/${d.slug}`} className="font-semibold hover:text-accent">
                      {d.name}
                    </Link>
                    {d.status === "approved" ? (
                      <span className="text-sm text-muted tabular-nums">
                        {s.buyers} customers · {s.coins} coins
                      </span>
                    ) : (
                      <Badge status={d.status} />
                    )}
                  </div>
                  {d.status === "approved" && (
                    <div className="mt-3">
                      <ShareButtons path={`/d/${d.slug}`} title={`${d.name} at Brew Lab`} />
                    </div>
                  )}
                  {d.status === "rejected" && d.reviewNote && <p className="mt-1 text-sm text-muted">{d.reviewNote}</p>}
                </li>
              );
            })}
          </ul>
        )}
        {profile && (
          <div className="mt-4">
            <CreatorSettings handle={profile.handle} showOnLeaderboard={profile.showOnLeaderboard} />
          </div>
        )}
      </section>

      <details className={`${cardClass} mt-10`}>
        <summary className="cursor-pointer font-semibold">How coins work</summary>
        <ul className="mt-3 space-y-1 text-sm text-muted">
          <li>+{PURCHASE_COINS} for every order you pick up (spendable after {HOLD_DAYS} days)</li>
          <li>+{CREATOR_COINS} when someone orders your signature drink</li>
          <li>{FREE_DRINK_COINS} coins = 1 free drink</li>
        </ul>
        <p className="mt-3 text-xs text-muted">
          No cash value, can&apos;t be transferred.{" "}
          <Link href="/terms#bean-coins" className="hover:text-accent">
            Terms
          </Link>
        </p>
      </details>

      <details className={`${cardClass} mt-3`}>
        <summary className="cursor-pointer font-semibold">Coin history</summary>
        {history.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No coins yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line text-sm">
            {history.map((e) => (
              <li key={e.id} className={`flex justify-between gap-4 py-2 ${e.voidedAt ? "opacity-50" : ""}`}>
                <span>
                  {kindLabels[e.kind]}
                  <span className="block text-xs text-muted">
                    {formatDate(e.createdAt)}
                    {e.voidedAt ? " · cancelled" : ""}
                  </span>
                </span>
                <span className={`tabular-nums font-medium ${e.amount < 0 ? "" : "text-accent"}`}>
                  {e.amount > 0 ? `+${e.amount}` : e.amount}
                </span>
              </li>
            ))}
          </ul>
        )}
      </details>
    </div>
  );
}

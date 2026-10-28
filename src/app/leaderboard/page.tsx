import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { TierBadge } from "@/components/tier-badge";
import { cardClass, PageTitle } from "@/components/ui";
import { TIER_THRESHOLDS } from "@/lib/coin-rules";
import { leaderboard, type LeaderboardRange } from "@/lib/signature";

export const metadata: Metadata = {
  title: "Top signature drinks",
  description: "The customer-made drinks people order most at Brew Lab.",
};

const tabs: { range: LeaderboardRange; label: string }[] = [
  { range: "week", label: "This week" },
  { range: "all", label: "Hall of Fame" },
];

export default async function LeaderboardPage({ searchParams }: PageProps<"/leaderboard">) {
  await connection();
  const range: LeaderboardRange = (await searchParams).range === "all" ? "all" : "week";
  const rows = await leaderboard(range);

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <PageTitle
        title="Top signature drinks"
        subtitle="Drinks created by customers, ranked by how many different people ordered them. The weekly board starts fresh every Monday."
      />
      <nav aria-label="Leaderboard range" className="mb-6 flex gap-2">
        {tabs.map((t) => (
          <Link
            key={t.range}
            href={t.range === "week" ? "/leaderboard" : "/leaderboard?range=all"}
            aria-current={t.range === range ? "page" : undefined}
            className={`rounded-full px-4 py-2 text-sm font-medium ${
              t.range === range ? "bg-accent text-accent-contrast" : "border border-line hover:border-accent"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {rows.length === 0 ? (
        <div className={cardClass}>
          <p>{range === "week" ? "No signature drinks ordered yet this week." : "No signature drinks ordered yet."}</p>
          <p className="mt-1 text-sm text-muted">
            Be first: build a drink, save it, and publish it from your{" "}
            <Link href="/saved" className="text-accent hover:underline">
              Saved drinks
            </Link>
            .
          </p>
        </div>
      ) : (
        <ol className="divide-y divide-line rounded-2xl border border-line bg-card">
          {rows.map((r, i) => (
            <li key={r.id} className="flex items-center gap-4 p-4">
              <span className={`w-8 shrink-0 text-center font-display text-2xl font-semibold ${i < 3 ? "text-accent" : "text-muted"}`}>{i + 1}</span>
              <div className="min-w-0 flex-1">
                <Link href={`/d/${r.slug}`} className="font-semibold hover:text-accent">
                  {r.name}
                </Link>
                <p className="flex flex-wrap items-center gap-2 text-sm text-muted">
                  @{r.handle} <TierBadge tier={r.tier} />
                </p>
              </div>
              <span className="shrink-0 text-right text-sm tabular-nums">
                <span className="block font-semibold">{r.buyers}</span>
                <span className="text-muted">{r.buyers === 1 ? "customer" : "customers"}</span>
              </span>
            </li>
          ))}
        </ol>
      )}

      <p className="mt-8 text-sm text-muted">
        Creators reach Gold with {TIER_THRESHOLDS.gold} different customers in a quarter and Platinum with {TIER_THRESHOLDS.platinum}.
        Creators&apos; own orders don&apos;t count. Only creators who chose to be listed appear here.
      </p>
    </div>
  );
}

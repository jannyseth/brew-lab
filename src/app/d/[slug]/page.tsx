import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ShareButtons } from "@/components/share-buttons";
import { TierBadge } from "@/components/tier-badge";
import { cardClass } from "@/components/ui";
import { formatCents } from "@/lib/drink";
import { getSignatureDrink } from "@/lib/signature";
import { AddSignatureButton } from "./add-signature-button";

export async function generateMetadata({ params }: PageProps<"/d/[slug]">): Promise<Metadata> {
  await connection();
  const { slug } = await params;
  const drink = await getSignatureDrink(slug);
  if (!drink) return { title: "Drink not found" };
  const description = drink.story || `A ${drink.baseName} made @${drink.handle}'s way: ${drink.summary}. Order it at Brew Lab.`;
  return {
    title: drink.name,
    description,
    alternates: { canonical: `/d/${drink.slug}` },
    openGraph: { type: "website", url: `/d/${drink.slug}`, siteName: "Brew Lab", title: `${drink.name} by @${drink.handle}`, description },
  };
}

/** Public page for a customer's signature drink: the link people share. */
export default async function SignatureDrinkPage({ params }: PageProps<"/d/[slug]">) {
  await connection();
  const { slug } = await params;
  const drink = await getSignatureDrink(slug);
  if (!drink) notFound();

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <p className="text-sm font-medium uppercase tracking-widest text-accent">Signature drink</p>
      <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight">{drink.name}</h1>
      <p className="mt-3 flex flex-wrap items-center gap-2 text-muted">
        by <span className="font-medium text-foreground">@{drink.handle}</span> <TierBadge tier={drink.tier} />
      </p>

      <div className={`${cardClass} mt-8`}>
        {drink.photoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={drink.photoUrl} alt="" className="mb-4 aspect-[4/3] w-full rounded-xl object-cover" />
        )}
        {drink.story && <p className="mb-4 text-lg">“{drink.story}”</p>}
        <p className="font-medium">{drink.baseName}</p>
        <p className="text-sm text-muted">{drink.summary}</p>
        {drink.priceCents === null ? (
          <p className="mt-4 text-sm text-muted">This recipe can&apos;t be ordered with today&apos;s menu.</p>
        ) : (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
            <span className="font-display text-2xl font-semibold tabular-nums">{formatCents(drink.priceCents)}</span>
            <AddSignatureButton
              line={{
                slug: drink.menuSlug,
                drinkName: drink.name,
                summary: `${drink.baseName} · ${drink.summary}`,
                selection: drink.selection,
                unitPriceCents: drink.priceCents,
                quantity: 1,
                signature: drink.slug,
              }}
            />
          </div>
        )}
      </div>

      <section className="mt-8">
        <h2 className="mb-3 font-semibold">Share this drink</h2>
        <ShareButtons path={`/d/${drink.slug}`} title={`${drink.name} by @${drink.handle} at Brew Lab`} />
      </section>

      <p className="mt-10 text-sm text-muted">
        Every time someone orders a signature drink, its creator earns bean coins.{" "}
        <Link href="/leaderboard" className="text-accent hover:underline">
          See the top drinks
        </Link>
      </p>
    </div>
  );
}

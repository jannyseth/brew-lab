import type { Metadata } from "next";
import { and, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { creatorProfiles, menuItems, savedDrinks } from "@/db/schema";
import { cardClass, PageTitle } from "@/components/ui";
import { CREATOR_COINS, FREE_DRINK_COINS } from "@/lib/coin-rules";
import { describeSelection } from "@/lib/drink";
import { getDrink } from "@/lib/menu";
import { requireRole } from "@/lib/session";
import { PublishForm } from "./publish-form";

export const metadata: Metadata = { title: "Publish a signature drink" };

export default async function PublishPage({ params }: PageProps<"/saved/[id]/publish">) {
  const { id } = await params;
  const user = await requireRole(["customer"], `/saved/${id}/publish`);
  const savedId = Number(id);
  if (!Number.isInteger(savedId)) notFound();

  const [saved] = await db
    .select({ id: savedDrinks.id, name: savedDrinks.name, selection: savedDrinks.selection, slug: menuItems.slug })
    .from(savedDrinks)
    .innerJoin(menuItems, eq(savedDrinks.menuItemId, menuItems.id))
    .where(and(eq(savedDrinks.id, savedId), eq(savedDrinks.userId, user.id)));
  if (!saved) notFound();
  const drink = await getDrink(saved.slug);
  const [profile] = await db.select().from(creatorProfiles).where(eq(creatorProfiles.userId, user.id));

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <Link href="/saved" className="text-sm text-muted hover:text-accent">
        ← Saved drinks
      </Link>
      <PageTitle
        title="Publish your signature drink"
        subtitle={`Every time another customer orders it, you earn ${CREATOR_COINS} bean coins. ${FREE_DRINK_COINS} coins buy any drink.`}
      />
      <div className={`${cardClass} mb-6`}>
        <p className="font-medium">{drink?.name ?? "No longer on the menu"}</p>
        <p className="text-sm text-muted">{drink ? describeSelection(drink, saved.selection).join(" · ") : ""}</p>
        <p className="mt-2 text-xs text-muted">The recipe is locked once published. To change it, publish a new drink.</p>
      </div>
      <PublishForm savedDrinkId={saved.id} defaultName={saved.name} profile={profile ? { handle: profile.handle, showOnLeaderboard: profile.showOnLeaderboard } : null} />
    </div>
  );
}

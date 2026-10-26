import type { Metadata } from "next";
import { desc, eq } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/db";
import { menuItems, savedDrinks } from "@/db/schema";
import { cardClass, PageTitle } from "@/components/ui";
import { describeSelection, formatCents, priceDrink } from "@/lib/drink";
import { getDrink } from "@/lib/menu";
import { requireRole } from "@/lib/session";
import { SavedDrinkActions } from "./saved-drink-actions";

export const metadata: Metadata = { title: "Saved drinks" };

export default async function SavedPage() {
  const user = await requireRole(["customer"], "/saved");
  const rows = await db
    .select({ id: savedDrinks.id, name: savedDrinks.name, selection: savedDrinks.selection, slug: menuItems.slug })
    .from(savedDrinks)
    .innerJoin(menuItems, eq(savedDrinks.menuItemId, menuItems.id))
    .where(eq(savedDrinks.userId, user.id))
    .orderBy(desc(savedDrinks.createdAt));

  // Re-price with today's menu; a saved recipe may no longer be valid.
  const drinks = await Promise.all(
    rows.map(async (row) => {
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

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <PageTitle title="Saved drinks" subtitle="Your custom recipes, ready to reorder." />
      {drinks.length === 0 ? (
        <div className={cardClass}>
          Nothing saved yet. Build a drink and tap <span className="font-medium">Save drink</span>.{" "}
          <Link href="/menu/build-your-own" className="font-medium text-accent">
            Build your own →
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {drinks.map((d) => (
            <li key={d.id} className={cardClass}>
              <div className="flex items-baseline justify-between gap-4">
                <h2 className="font-display text-xl font-semibold">{d.name}</h2>
                {d.priceCents !== null && <span className="tabular-nums">{formatCents(d.priceCents)}</span>}
              </div>
              <p className="text-sm text-muted">
                {d.drinkName} · {d.summary}
              </p>
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
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { cupVisual } from "@/lib/cup-visual";
import { describeSelection, initialSelection, priceDrink } from "@/lib/drink";
import { getBestsellers, getDrink, getMenu } from "@/lib/menu";
import { MenuGrid, type MenuCard } from "./menu-grid";

export const metadata: Metadata = { title: "Menu" };

export default async function MenuPage() {
  const [menu, bestsellers] = await Promise.all([getMenu(), getBestsellers()]);

  // Each card shows the drink's standard recipe: its cup, price and a one-tap add.
  const sections = await Promise.all(
    menu.map(async (category) => ({
      id: category.slug,
      name: category.name,
      cards: (
        await Promise.all(
          category.items.map(async (item): Promise<MenuCard | null> => {
            const drink = await getDrink(item.slug);
            if (!drink) return null;
            const selection = initialSelection(drink);
            const price = priceDrink(drink, selection);
            const iced = drink.groups.find((g) => g.slug === "temperature")?.options.every((o) => o.slug === "iced");
            return {
              slug: drink.slug,
              name: drink.name,
              description: drink.description,
              isCustom: drink.isCustom,
              selection,
              summary: describeSelection(drink, selection).join(" · "),
              priceCents: price.ok ? price.totalCents : drink.basePriceCents,
              visual: cupVisual(drink, selection),
              tags: [...(bestsellers.includes(drink.name) ? ["Bestseller"] : []), ...(iced ? ["Iced only"] : [])],
            };
          }),
        )
      ).filter((c): c is MenuCard => c !== null),
    })),
  );

  return (
    <div className="pb-28">
      <section className="bg-accent text-accent-contrast">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-6 md:py-8">
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest opacity-80">Order ahead · pay at pickup</p>
            <h1 className="mt-1 font-display text-3xl font-semibold md:text-4xl">What are you sipping today?</h1>
          </div>
          <Link
            href="/menu/build-your-own"
            className="rounded-full bg-accent-contrast px-5 py-2.5 text-sm font-semibold text-accent shadow-sm hover:opacity-90"
          >
            Build your own →
          </Link>
        </div>
      </section>
      <MenuGrid sections={sections} />
    </div>
  );
}

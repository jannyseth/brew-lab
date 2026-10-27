import type { Metadata } from "next";
import Link from "next/link";
import { describeSelection, initialSelection, priceDrink } from "@/lib/drink";
import { getDrink, getMenu } from "@/lib/menu";
import { MenuGrid, type MenuCard } from "./menu-grid";

export const metadata: Metadata = { title: "Menu" };

export default async function MenuPage() {
  const menu = await getMenu();

  // Each card carries its drink's standard recipe, so "+" can add it in one tap.
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
            const icedOnly = drink.groups.find((g) => g.slug === "temperature")?.options.every((o) => o.slug === "iced");
            return {
              slug: drink.slug,
              name: drink.name,
              description: drink.description,
              photoUrl: drink.photoUrl ?? null,
              isCustom: drink.isCustom,
              selection,
              summary: describeSelection(drink, selection).join(" · "),
              priceCents: drink.isCustom ? drink.basePriceCents : price.ok ? price.totalCents : drink.basePriceCents,
              tag: drink.isCustom ? "Make it yours" : icedOnly ? "Iced" : null,
            };
          }),
        )
      ).filter((c): c is MenuCard => c !== null),
    })),
  );

  return (
    <div className="pb-28">
      <section className="mx-auto flex max-w-6xl flex-wrap items-end justify-between gap-4 px-4 pb-2 pt-8">
        <div>
          <p className="text-sm font-semibold uppercase tracking-widest text-accent">Order ahead · pay at pickup</p>
          <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight md:text-4xl">Menu</h1>
        </div>
        <Link href="/menu/build-your-own" className="text-sm font-semibold text-accent hover:underline">
          Build your own →
        </Link>
      </section>
      <MenuGrid sections={sections} />
    </div>
  );
}

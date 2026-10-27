import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDrink, getDrinkSlugs } from "@/lib/menu";
import { DrinkForm } from "./drink-form";
import { GameBuilder } from "./game-builder";

export async function generateStaticParams() {
  const slugs = await getDrinkSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps<"/menu/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const drink = await getDrink(slug);
  return { title: drink?.name ?? "Drink not found" };
}

export default async function DrinkPage({ params }: PageProps<"/menu/[slug]">) {
  const { slug } = await params;
  const drink = await getDrink(slug);
  if (!drink) notFound();
  // Build Your Own is played as a game; menu drinks use a simple order form.
  return drink.isCustom ? <GameBuilder drink={drink} /> : <DrinkForm drink={drink} />;
}

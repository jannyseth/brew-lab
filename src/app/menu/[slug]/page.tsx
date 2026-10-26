import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDrink, getDrinkSlugs } from "@/lib/menu";
import { DrinkBuilder } from "./drink-builder";

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

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <Link href="/menu" className="text-sm text-muted hover:text-accent">
        ← Back to menu
      </Link>
      <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight">{drink.name}</h1>
      <p className="mt-2 max-w-xl text-muted">{drink.description}</p>
      <DrinkBuilder drink={drink} />
    </div>
  );
}

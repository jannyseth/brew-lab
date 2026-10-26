import type { Metadata } from "next";
import Link from "next/link";
import { formatCents } from "@/lib/drink";
import { getMenu } from "@/lib/menu";

export const metadata: Metadata = { title: "Menu" };

export default async function MenuPage() {
  const menu = await getMenu();

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <h1 className="font-display text-4xl font-semibold tracking-tight">Menu</h1>
      <p className="mt-2 text-muted">Every drink can be customized. Prices shown are for a small.</p>

      {menu.map((category) => (
        <section key={category.id} className="mt-10">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-accent">{category.name}</h2>
          <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {category.items.map((item) => (
              <li key={item.id}>
                <Link
                  href={`/menu/${item.slug}`}
                  className="flex h-full flex-col rounded-2xl border border-line bg-card p-5 transition hover:border-accent hover:shadow-sm"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <h3 className="font-display text-xl font-semibold">{item.name}</h3>
                    <span className="shrink-0 text-sm font-medium tabular-nums">
                      {item.isCustom ? "from " : ""}
                      {formatCents(item.basePriceCents)}
                    </span>
                  </div>
                  <p className="mt-2 flex-1 text-sm text-muted">{item.description}</p>
                  <span className="mt-4 text-sm font-medium text-accent">
                    {item.isCustom ? "Start building →" : "Customize →"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

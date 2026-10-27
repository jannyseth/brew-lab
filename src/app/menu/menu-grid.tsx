"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useCart } from "@/components/cart";
import { CupArt } from "@/components/cup-art";
import type { CupVisual } from "@/lib/cup-visual";
import { formatCents, type Selection } from "@/lib/drink";

export type MenuCard = {
  slug: string;
  name: string;
  description: string;
  isCustom: boolean;
  selection: Selection;
  summary: string;
  priceCents: number;
  visual: CupVisual;
  tags: string[];
};

type Section = { id: string; name: string; cards: MenuCard[] };

/** Grab-and-go menu: category chips, big drink cards and one-tap add. */
export function MenuGrid({ sections }: { sections: Section[] }) {
  const cart = useCart();
  const [active, setActive] = useState(sections[0]?.id);
  const [toast, setToast] = useState<string | null>(null);

  // Highlight the chip of the section currently on screen.
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-120px 0px -60% 0px" },
    );
    sections.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [sections]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(timer);
  }, [toast]);

  const count = cart.lines.reduce((n, l) => n + l.quantity, 0);
  const total = cart.lines.reduce((n, l) => n + l.quantity * l.unitPriceCents, 0);

  return (
    <>
      <nav aria-label="Menu categories" className="sticky top-0 z-20 border-b border-line bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl gap-2 overflow-x-auto px-4 py-3">
          {sections.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              aria-current={active === s.id ? "true" : undefined}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition ${
                active === s.id ? "bg-foreground text-background" : "bg-card text-muted ring-1 ring-line hover:text-foreground"
              }`}
            >
              {s.name}
            </a>
          ))}
        </div>
      </nav>

      <div className="mx-auto max-w-6xl px-4">
        {sections.map((section) => (
          <section key={section.id} id={section.id} className="scroll-mt-20 pt-8">
            <h2 className="font-display text-2xl font-semibold">{section.name}</h2>
            <ul className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 lg:grid-cols-4">
              {section.cards.map((card) => (
                <li key={card.slug} className="group relative flex flex-col overflow-hidden rounded-3xl bg-card ring-1 ring-line transition hover:-translate-y-0.5 hover:shadow-md hover:ring-accent">
                  <Link href={`/menu/${card.slug}`} className="flex flex-1 flex-col">
                    <div className="relative flex aspect-square items-center justify-center bg-gradient-to-b from-accent-soft to-transparent p-3">
                      <CupArt visual={card.visual} className="h-full w-auto transition-transform duration-300 group-hover:scale-105" />
                      {card.tags.length > 0 && (
                        <span className="absolute left-2 top-2 flex flex-col gap-1">
                          {card.tags.map((t) => (
                            <span key={t} className="rounded-full bg-foreground px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-background">
                              {t}
                            </span>
                          ))}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-1 flex-col p-3 pr-14">
                      <h3 className="font-semibold leading-tight">{card.name}</h3>
                      <p className="mt-1 line-clamp-2 text-xs text-muted">{card.description}</p>
                      <p className="mt-auto pt-2 font-display text-lg font-semibold tabular-nums">
                        {card.isCustom && <span className="mr-1 text-xs font-sans font-normal text-muted">from</span>}
                        {formatCents(card.priceCents)}
                      </p>
                    </div>
                  </Link>
                  {card.isCustom ? (
                    <Link
                      href={`/menu/${card.slug}`}
                      aria-label={`Build your own coffee`}
                      className="absolute bottom-3 right-3 flex h-10 w-10 items-center justify-center rounded-full bg-accent text-xl text-accent-contrast shadow-sm transition active:scale-90"
                    >
                      →
                    </Link>
                  ) : (
                    <button
                      type="button"
                      aria-label={`Add a ${card.name} to your order`}
                      onClick={() => {
                        cart.add({
                          slug: card.slug,
                          drinkName: card.name,
                          summary: card.summary,
                          selection: card.selection,
                          unitPriceCents: card.priceCents,
                          quantity: 1,
                        });
                        setToast(`${card.name} added`);
                      }}
                      className="absolute bottom-3 right-3 flex h-10 w-10 items-center justify-center rounded-full bg-accent text-2xl leading-none text-accent-contrast shadow-sm transition hover:scale-105 active:scale-90"
                    >
                      +
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))}
        <p className="mt-6 text-center text-xs text-muted">Tap a drink to customize it, or + to add its standard recipe.</p>
      </div>

      {(count > 0 || toast) && (
        <div className="fixed inset-x-0 bottom-4 z-30 flex justify-center px-4">
          <Link
            href="/cart"
            className="flex w-full max-w-md items-center justify-between gap-4 rounded-full bg-foreground px-5 py-3.5 text-background shadow-xl transition active:scale-[.98]"
          >
            <span className="text-sm font-medium" aria-live="polite">
              {toast ? `✓ ${toast}` : `${count} ${count === 1 ? "drink" : "drinks"} in your order`}
            </span>
            <span className="flex items-center gap-2 text-sm font-semibold tabular-nums">
              {formatCents(total)} · View cart →
            </span>
          </Link>
        </div>
      )}
    </>
  );
}

import type { Metadata } from "next";
import { DEFAULT_PHOTO_CREDITS } from "@/lib/menu-photos";

export const metadata: Metadata = { title: "Photo credits" };

export default function CreditsPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="font-display text-4xl font-semibold tracking-tight">Photo credits</h1>
      <p className="mt-4 text-muted">
        Our starter menu photos come from Wikimedia Commons and are free to use (public domain or CC0). We cropped and
        colour-graded them to match. Thank you to the photographers.
      </p>
      <ul className="mt-8 divide-y divide-line rounded-2xl border border-line bg-card">
        {Object.entries(DEFAULT_PHOTO_CREDITS).map(([slug, c]) => (
          <li key={slug} className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-3 text-sm">
            <span>
              <span className="font-medium">{c.drink}</span>
              <span className="block text-muted">
                “{c.title}” by {c.author}
              </span>
            </span>
            <a href={c.source} target="_blank" rel="noopener noreferrer" className="text-accent underline">
              {c.license} · source
            </a>
          </li>
        ))}
      </ul>
    </article>
  );
}

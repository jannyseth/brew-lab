"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { faq, FACEBOOK_URL } from "@/lib/faq";

const askAbout = (q: string) => `/support/new?topic=${encodeURIComponent(q)}`;

/** A "Help" tab on the side of every page that opens the FAQ without leaving the page. */
export function HelpDrawer() {
  const pathname = usePathname();
  const dialog = useRef<HTMLDialogElement>(null);
  const [query, setQuery] = useState("");

  // Close when a link inside takes the visitor to another page.
  useEffect(() => dialog.current?.close(), [pathname]);

  // The admin and support areas have their own tools; the FAQ page already shows everything.
  if (pathname.startsWith("/admin") || pathname === "/faq") return null;

  const q = query.trim().toLowerCase();
  const sections = faq
    .map((s) => ({ ...s, items: q ? s.items.filter((i) => `${i.q} ${i.a}`.toLowerCase().includes(q)) : s.items }))
    .filter((s) => s.items.length > 0);

  return (
    <>
      <button
        type="button"
        onClick={() => dialog.current?.showModal()}
        className="fixed right-0 top-1/2 z-30 -translate-y-1/2 rounded-l-xl bg-foreground px-2 py-3 text-xs font-semibold text-background shadow-lg [writing-mode:vertical-rl] hover:px-3 print:hidden"
      >
        Help
      </button>
      <dialog
        ref={dialog}
        onClick={(e) => e.target === dialog.current && dialog.current?.close()}
        aria-label="Help"
        className="fixed inset-y-0 right-0 left-auto m-0 h-dvh max-h-dvh w-full max-w-md bg-transparent p-0 text-foreground backdrop:bg-black/40"
      >
        <div className="flex h-full flex-col bg-background shadow-2xl sm:rounded-l-3xl">
          <header className="flex items-center justify-between border-b border-line px-5 py-4">
            <h2 className="font-display text-xl font-semibold">Help</h2>
            <button
              type="button"
              onClick={() => dialog.current?.close()}
              aria-label="Close"
              className="flex h-9 w-9 items-center justify-center rounded-full text-xl hover:bg-accent-soft"
            >
              ×
            </button>
          </header>
          <div className="flex-1 overflow-y-auto px-5 py-4">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search questions"
              aria-label="Search questions"
              className="w-full rounded-xl border border-line bg-card px-4 py-2.5 outline-none focus:border-accent"
            />
            {sections.length === 0 && <p className="mt-6 text-center text-sm text-muted">No answers match. Message us below.</p>}
            {sections.map((section) => (
              <section key={section.title} className="mt-5">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted">{section.title}</h3>
                <div className="divide-y divide-line rounded-2xl border border-line bg-card">
                  {section.items.map((item) => (
                    <details key={item.q} className="group px-4 py-3" open={q.length > 0}>
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium">
                        {item.q}
                        <span aria-hidden className="text-muted transition group-open:rotate-45">
                          +
                        </span>
                      </summary>
                      <p className="mt-2 text-sm text-muted">{item.a}</p>
                      <Link href={askAbout(item.q)} className="mt-2 inline-block text-xs font-medium text-accent hover:underline">
                        Still need help? Message us
                      </Link>
                    </details>
                  ))}
                </div>
              </section>
            ))}
          </div>
          <footer className="flex flex-wrap items-center gap-3 border-t border-line px-5 py-4 text-sm">
            <Link href="/support/new" className="rounded-full bg-accent px-5 py-2.5 font-medium text-accent-contrast hover:opacity-90">
              Message us
            </Link>
            <Link href="/support" className="text-accent hover:underline">
              Your messages
            </Link>
            <a href={FACEBOOK_URL} target="_blank" rel="noopener noreferrer" className="ml-auto text-muted hover:text-accent">
              Facebook
            </a>
          </footer>
        </div>
      </dialog>
    </>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavLink = { href: string; label: string; badge?: number; exact?: boolean };
export type NavSection = { title?: string; links: NavLink[] };

/**
 * Sidebar for the branch and admin areas. It stays in view while the page
 * scrolls (sticky), and turns into a scrollable bar on small screens.
 */
export function SideNav({ title, sections }: { title: string; sections: NavSection[] }) {
  const pathname = usePathname();
  const isActive = (link: NavLink) =>
    link.exact ? pathname === link.href : pathname === link.href || pathname.startsWith(`${link.href}/`);

  return (
    <nav
      aria-label={title}
      className="-mx-4 border-b border-line bg-background/95 px-4 py-2 backdrop-blur md:top-6 md:mx-0 md:max-h-[calc(100vh-3rem)] md:overflow-y-auto md:rounded-2xl md:border md:bg-card md:p-3 print:hidden"
    >
      <p className="hidden px-3 pb-2 pt-1 text-xs font-semibold uppercase tracking-widest text-muted md:block">{title}</p>
      <div className="flex gap-1 overflow-x-auto md:flex-col md:gap-4 md:overflow-visible">
        {sections.map((section, i) => (
          <div key={section.title ?? i} className="flex shrink-0 gap-1 md:flex-col">
            {section.title && (
              <p className="hidden truncate px-3 pt-1 text-xs font-semibold text-muted md:block" title={section.title}>
                {section.title}
              </p>
            )}
            {section.links.map((link) => {
              const active = isActive(link);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex shrink-0 items-center justify-between gap-2 whitespace-nowrap rounded-xl px-3 py-2 text-sm font-medium transition ${
                    active ? "bg-accent text-accent-contrast" : "text-muted hover:bg-accent-soft hover:text-foreground"
                  }`}
                >
                  <span>
                    {section.title && <span className="md:hidden">{section.title} · </span>}
                    {link.label}
                  </span>
                  {link.badge ? (
                    <span
                      className={`rounded-full px-2 text-xs ${active ? "bg-accent-contrast/20" : "bg-accent text-accent-contrast"}`}
                      aria-label={`${link.badge} waiting`}
                    >
                      {link.badge}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </div>
        ))}
      </div>
    </nav>
  );
}

export function SideNavSkeleton() {
  return <div className="h-12 rounded-2xl border border-line bg-card md:h-64" aria-hidden />;
}

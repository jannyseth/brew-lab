import { Suspense } from "react";
import { SideNavSkeleton } from "./side-nav";

/** Two-column layout: a sticky sidebar next to the page content. */
export function AreaShell({ nav, children }: { nav: React.ReactNode; children: React.ReactNode }) {
  return (
    // minmax(0,1fr) on phones too: without it the sidebar's long row of links
    // widens the whole page and the phone zooms out to "desktop mode".
    <div className="mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)] gap-6 px-4 pb-12 md:grid-cols-[220px_minmax(0,1fr)] md:pt-6">
      <div className="sticky top-0 z-20 min-w-0 self-start md:top-6">
        <Suspense fallback={<SideNavSkeleton />}>{nav}</Suspense>
      </div>
      <div className="min-w-0 pt-4 md:pt-0">{children}</div>
    </div>
  );
}

export function AreaTitle({ title, subtitle, actions }: { title: string; subtitle?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">{title}</h1>
        {subtitle && <p className="mt-2 max-w-2xl text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

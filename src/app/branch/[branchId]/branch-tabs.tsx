"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";

/** One branch, four tabs: everything about it in one place. */
export function BranchTabs() {
  const { branchId } = useParams<{ branchId: string }>();
  const pathname = usePathname();
  const base = `/branch/${branchId}`;
  const tabs = [
    { href: base, label: "Dashboard & sales", active: pathname === base },
    { href: `${base}/orders`, label: "Orders", active: pathname.startsWith(`${base}/orders`) },
    {
      href: `${base}/lounge`,
      label: "Employee lounge",
      active: pathname.startsWith(`${base}/lounge`) || pathname.startsWith(`${base}/clock`),
    },
    { href: `${base}/payroll`, label: "Payroll", active: pathname.startsWith(`${base}/payroll`) },
  ];
  return (
    <nav aria-label="Branch sections" className="mb-6 flex gap-1 overflow-x-auto rounded-full bg-accent-soft p-1 print:hidden">
      {tabs.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          aria-current={t.active ? "page" : undefined}
          className={`flex-1 whitespace-nowrap rounded-full px-4 py-2 text-center text-sm font-medium transition ${
            t.active ? "bg-card text-foreground shadow" : "text-muted hover:text-foreground"
          }`}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}

import Link from "next/link";

const tabs = [
  { href: "/admin", label: "Approvals" },
  { href: "/admin/branches", label: "Branches" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/finance", label: "Finance" },
  { href: "/admin/activity", label: "Activity log" },
] as const;

export function AdminNav({ active, subtitle }: { active: (typeof tabs)[number]["label"]; subtitle?: string }) {
  return (
    <div className="mb-8">
      <h1 className="font-display text-4xl font-semibold tracking-tight">Admin</h1>
      {subtitle && <p className="mt-2 text-muted">{subtitle}</p>}
      <nav className="mt-6 flex gap-1 overflow-x-auto border-b border-line">
        {tabs.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className={`-mb-px shrink-0 border-b-2 px-4 py-2 text-sm font-medium ${
              tab.label === active ? "border-accent text-foreground" : "border-transparent text-muted hover:text-foreground"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}

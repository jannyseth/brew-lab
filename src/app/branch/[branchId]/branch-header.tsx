import Link from "next/link";
import { Badge } from "@/components/ui";

const tabs = [
  { href: "", label: "Orders" },
  { href: "/sales", label: "Sales" },
  { href: "/payroll", label: "Payroll" },
] as const;

export function BranchHeader({
  branch,
  active,
}: {
  branch: { id: number; name: string; status: string };
  active: (typeof tabs)[number]["label"];
}) {
  return (
    <div className="mb-8">
      <Link href="/branch" className="text-sm text-muted hover:text-accent">
        ← All branches
      </Link>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-4xl font-semibold tracking-tight">{branch.name}</h1>
        <Badge status={branch.status} />
      </div>
      {branch.status !== "approved" && (
        <p className="mt-2 text-sm text-muted">Customers can&apos;t order from this branch until the admin approves it.</p>
      )}
      <nav className="mt-6 flex gap-2 border-b border-line">
        {tabs.map((tab) => (
          <Link
            key={tab.label}
            href={`/branch/${branch.id}${tab.href}`}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${
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

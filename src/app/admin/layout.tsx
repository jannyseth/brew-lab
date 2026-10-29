import { and, count, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { branches, managerApplications, signatureDrinks, supportTickets } from "@/db/schema";
import { AreaShell } from "@/components/area-shell";
import { SideNav } from "@/components/side-nav";
import { getSession } from "@/lib/session";

async function AdminSidebar() {
  const session = await getSession();
  const role = session?.user.role;
  if (role !== "super_admin" && role !== "support_agent") return null;
  // Unanswered tickets nobody has taken yet.
  const [unclaimed] = await db
    .select({ n: count() })
    .from(supportTickets)
    .where(and(eq(supportTickets.status, "open"), isNull(supportTickets.assignedTo)));
  const support = { href: "/admin/support", label: "Support inbox", badge: unclaimed.n };
  if (role === "support_agent") return <SideNav title="Support" sections={[{ links: [support] }]} />;

  const [[owners], [pendingBranches], [pendingDrinks]] = await Promise.all([
    db.select({ n: count() }).from(managerApplications).where(eq(managerApplications.status, "pending")),
    db.select({ n: count() }).from(branches).where(eq(branches.status, "pending")),
    db.select({ n: count() }).from(signatureDrinks).where(eq(signatureDrinks.status, "pending")),
  ]);
  return (
    <SideNav
      title="Admin"
      sections={[
        {
          links: [
            { href: "/admin", label: "Dashboard", exact: true },
            { href: "/admin/earnings", label: "Earnings" },
            { href: "/admin/dataset", label: "Dataset" },
          ],
        },
        {
          title: "Manage",
          links: [
            { href: "/admin/approvals", label: "Approvals", badge: owners.n + pendingBranches.n + pendingDrinks.n },
            support,
            { href: "/admin/branches", label: "Branches" },
            { href: "/admin/menu", label: "Menu photos" },
            { href: "/admin/users", label: "Users" },
            { href: "/admin/activity", label: "Activity log" },
          ],
        },
      ]}
    />
  );
}

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return <AreaShell nav={<AdminSidebar />}>{children}</AreaShell>;
}

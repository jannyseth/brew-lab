import { count, eq } from "drizzle-orm";
import { db } from "@/db";
import { branches, managerApplications, signatureDrinks } from "@/db/schema";
import { AreaShell } from "@/components/area-shell";
import { SideNav } from "@/components/side-nav";
import { getSession } from "@/lib/session";

async function AdminSidebar() {
  const session = await getSession();
  if (session?.user.role !== "super_admin") return null;
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

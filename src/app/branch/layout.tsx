import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { branches } from "@/db/schema";
import { AreaShell } from "@/components/area-shell";
import { SideNav, type NavSection } from "@/components/side-nav";
import { getSession } from "@/lib/session";

async function BranchSidebar() {
  const session = await getSession();
  const role = session?.user.role;
  if (role === "branch_applicant") {
    return <SideNav title="Branch owner" sections={[{ links: [{ href: "/branch", label: "Verification", exact: true }] }]} />;
  }
  if (role !== "branch_manager" || !session) return null;

  // Only approved branches get their own section; the rest are under "Manage branches".
  const approved = await db
    .select({ id: branches.id, name: branches.name })
    .from(branches)
    .where(and(eq(branches.managerId, session.user.id), eq(branches.status, "approved")))
    .orderBy(asc(branches.name));

  const sections: NavSection[] = [
    {
      links: [
        { href: "/branch", label: "Overview", exact: true },
        { href: "/branch/manage", label: "Manage branches" },
      ],
    },
    ...(approved.length > 0
      ? [{ title: "Branches", links: approved.map((b) => ({ href: `/branch/${b.id}`, label: b.name })) }]
      : []),
  ];
  return <SideNav title="Your branches" sections={sections} />;
}

export default function BranchLayout({ children }: LayoutProps<"/branch">) {
  return <AreaShell nav={<BranchSidebar />}>{children}</AreaShell>;
}

import type { Role } from "@/lib/auth";
import { getManagedBranch } from "@/lib/branch-access";
import { salesSheets } from "@/lib/exports";
import { fileDate, workbookResponse } from "@/lib/sheets";
import { getSession } from "@/lib/session";
import { logActivity } from "@/lib/audit";

// The branch owner's sales sheet: daily summary, every order and every item, last 12 months.
export async function GET(_: Request, { params }: RouteContext<"/api/exports/branch/[branchId]/sales">) {
  const session = await getSession();
  if (!session) return new Response("Please sign in.", { status: 401 });
  const branch = await getManagedBranch(Number((await params).branchId), { id: session.user.id, role: session.user.role as Role });
  if (!branch) return new Response("Not found", { status: 404 });

  await logActivity({ userId: session.user.id, userEmail: session.user.email, action: "export.branch_sales", targetType: "branch", targetId: branch.id });
  const slug = branch.name.replace(/[^A-Za-z0-9]+/g, "-").toLowerCase();
  return workbookResponse(`brew-lab-${slug}-sales-${fileDate()}.xlsx`, await salesSheets([branch.id], { includePickupNames: true }));
}

import { getManagedBranch } from "@/lib/branch-access";
import type { Role } from "@/lib/auth";
import { loadPayslip, payslipFilename, renderPayslip } from "@/lib/payslips";
import { getSession } from "@/lib/session";

// One click: the payslip PDF, for the owner of the branch that logged it.
export async function GET(_: Request, { params }: RouteContext<"/api/payslips/[entryId]">) {
  const session = await getSession();
  if (!session) return new Response("Please sign in.", { status: 401 });
  const entryId = Number((await params).entryId);
  const row = Number.isInteger(entryId) ? await loadPayslip(entryId) : null;
  if (!row || !(await getManagedBranch(row.branch.id, { id: session.user.id, role: session.user.role as Role }))) {
    return new Response("Not found", { status: 404 });
  }
  return new Response(new Uint8Array(await renderPayslip(row)), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${payslipFilename(row)}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

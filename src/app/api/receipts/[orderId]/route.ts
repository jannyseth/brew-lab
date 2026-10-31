import { loadReceipt, receiptNumber, type ReceiptCopy } from "@/components/receipt";
import { getManagedBranch } from "@/lib/branch-access";
import type { Role } from "@/lib/auth";
import { receiptPdf } from "@/lib/pdf";
import { getSession } from "@/lib/session";

// One click: returns the receipt as a PDF download.
// The customer who placed the order gets the customer copy, the branch's owner the branch copy,
// and the worker who made it the worker copy.
export async function GET(_: Request, { params }: RouteContext<"/api/receipts/[orderId]">) {
  const session = await getSession();
  if (!session) return new Response("Please sign in.", { status: 401 });
  const orderId = Number((await params).orderId);
  const data = Number.isInteger(orderId) ? await loadReceipt(orderId) : null;
  if (!data) return new Response("Not found", { status: 404 });

  const role = session.user.role as Role;
  let copy: ReceiptCopy | null = null;
  if (role === "customer" && data.order.userId === session.user.id) copy = "Customer copy";
  if (role === "branch_manager" && (await getManagedBranch(data.order.branchId, { id: session.user.id, role }))) copy = "Branch copy";
  // The worker who made a finished order keeps their own copy.
  if (role === "worker" && data.order.status === "completed" && data.maker?.userId === session.user.id) copy = "Worker copy";
  if (!copy) return new Response("Not found", { status: 404 });

  const number = receiptNumber(data.order.id);
  const pdf = await receiptPdf({
    receiptNumber: number,
    copy,
    branch: data.branch,
    order: data.order,
    items: data.items,
    makerName: data.maker?.name,
  });
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="brew-lab-receipt-${number}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}

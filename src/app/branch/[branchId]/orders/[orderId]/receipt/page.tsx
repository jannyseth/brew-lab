import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadReceipt, Receipt } from "@/components/receipt";
import { getManagedBranch } from "@/lib/branch-access";
import { requireRole } from "@/lib/session";

export const metadata: Metadata = { title: "Receipt" };

export default async function BranchReceiptPage({ params }: PageProps<"/branch/[branchId]/orders/[orderId]/receipt">) {
  const { branchId, orderId } = await params;
  const user = await requireRole(["branch_manager"], `/branch/${branchId}/orders/${orderId}/receipt`);
  const branch = await getManagedBranch(Number(branchId), user);
  const data = branch && Number.isInteger(Number(orderId)) ? await loadReceipt(Number(orderId)) : null;
  // The order must belong to this owner's branch.
  if (!data || data.order.branchId !== branch?.id) notFound();
  return <Receipt data={data} copy="Branch copy" />;
}

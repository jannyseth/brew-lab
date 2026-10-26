import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadReceipt, Receipt } from "@/components/receipt";
import { requireRole } from "@/lib/session";

export const metadata: Metadata = { title: "Receipt" };

export default async function CustomerReceiptPage({ params }: PageProps<"/orders/[id]/receipt">) {
  const { id } = await params;
  const user = await requireRole(["customer"], `/orders/${id}/receipt`);
  const data = Number.isInteger(Number(id)) ? await loadReceipt(Number(id)) : null;
  // Customers can only see receipts for their own orders.
  if (!data || data.order.userId !== user.id) notFound();
  return <Receipt data={data} copy="Customer copy" />;
}

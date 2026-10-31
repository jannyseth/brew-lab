import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadReceipt, Receipt } from "@/components/receipt";
import { requireRole } from "@/lib/session";

export const metadata: Metadata = { title: "Receipt" };

/** The worker's copy of an order they made. */
export default async function WorkerReceiptPage({ params }: PageProps<"/work/receipts/[orderId]">) {
  const { orderId } = await params;
  const user = await requireRole(["worker"], `/work/receipts/${orderId}`);
  const data = Number.isInteger(Number(orderId)) ? await loadReceipt(Number(orderId)) : null;
  if (!data || data.order.status !== "completed" || data.maker?.userId !== user.id) notFound();
  return <Receipt data={data} copy="Worker copy" />;
}

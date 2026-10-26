import type { Metadata } from "next";
import { and, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { branches, orderItems, orders } from "@/db/schema";
import { AutoRefresh } from "@/components/auto-refresh";
import { Badge, buttonPrimary, cardClass, formatDateTime } from "@/components/ui";
import { formatCents } from "@/lib/drink";
import { requireRole } from "@/lib/session";
import { CancelOrderButton } from "./cancel-order-button";

export const metadata: Metadata = { title: "Order status" };

const steps = ["placed", "preparing", "ready", "completed"] as const;
const stepLabels = { placed: "Received", preparing: "Preparing", ready: "Ready for pickup", completed: "Picked up" };

export default async function OrderPage({ params }: PageProps<"/orders/[id]">) {
  const { id } = await params;
  const user = await requireRole(["customer"], `/orders/${id}`);
  const orderId = Number(id);
  if (!Number.isInteger(orderId)) notFound();

  // Customers can only see their own orders.
  const [order] = await db
    .select({ order: orders, branch: branches })
    .from(orders)
    .innerJoin(branches, eq(orders.branchId, branches.id))
    .where(and(eq(orders.id, orderId), eq(orders.userId, user.id)));
  if (!order) notFound();
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));

  const { status } = order.order;
  const current = steps.indexOf(status as (typeof steps)[number]);
  const active = status !== "completed" && status !== "cancelled";

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      {active && <AutoRefresh seconds={15} />}
      <Link href="/orders" className="text-sm text-muted hover:text-accent">
        ← All orders
      </Link>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-4xl font-semibold tracking-tight">Order #{order.order.id}</h1>
        <Badge status={status} />
      </div>
      <p className="mt-2 text-muted">
        {order.branch.name} · {order.branch.address} · placed {formatDateTime(order.order.createdAt)}
      </p>

      {status === "cancelled" ? (
        <p className={`${cardClass} mt-6`}>This order was cancelled.</p>
      ) : (
        <ol className="mt-8 grid grid-cols-4 gap-2 text-center text-xs sm:text-sm">
          {steps.map((step, i) => (
            <li key={step}>
              <div className={`h-2 rounded-full ${i <= current ? "bg-accent" : "bg-line"}`} />
              <p className={`mt-2 ${i === current ? "font-semibold" : "text-muted"}`}>{stepLabels[step]}</p>
            </li>
          ))}
        </ol>
      )}

      <ul className="mt-8 divide-y divide-line rounded-2xl border border-line bg-card">
        {items.map((item) => (
          <li key={item.id} className="flex justify-between gap-4 p-4">
            <div>
              <p className="font-medium">
                {item.quantity} × {item.drinkName}
              </p>
              <p className="text-sm text-muted">{item.summary}</p>
            </div>
            <span className="tabular-nums">{formatCents(item.unitPriceCents * item.quantity)}</span>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex items-center justify-between">
        <span className="text-muted">{order.order.paidAt ? "Paid" : "Pay at pickup"}</span>
        <span className="font-display text-2xl font-semibold tabular-nums">{formatCents(order.order.totalCents)}</span>
      </div>
      <div className="mt-8 flex flex-wrap items-center gap-4">
        <a href={`/api/receipts/${order.order.id}`} download className={buttonPrimary}>
          Download receipt (PDF)
        </a>
        <Link href={`/orders/${order.order.id}/receipt`} className="text-sm text-muted hover:text-accent">
          View or print
        </Link>
      </div>
      {status === "placed" && <CancelOrderButton orderId={order.order.id} />}
    </div>
  );
}

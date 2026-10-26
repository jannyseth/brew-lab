import { eq } from "drizzle-orm";
import { db } from "@/db";
import { branches, orderItems, orders } from "@/db/schema";
import { formatCents } from "@/lib/drink";
import { PrintButton } from "./print-button";
import { buttonPrimary, formatDateTime } from "./ui";

/** Loads everything a receipt needs. Callers must check who may see the order first. */
export async function loadReceipt(orderId: number) {
  const [row] = await db
    .select({ order: orders, branch: branches })
    .from(orders)
    .innerJoin(branches, eq(orders.branchId, branches.id))
    .where(eq(orders.id, orderId));
  if (!row) return null;
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
  return { ...row, items };
}

export const receiptNumber = (orderId: number) => `R-${String(orderId).padStart(6, "0")}`;

export function Receipt({
  data,
  copy,
}: {
  data: NonNullable<Awaited<ReturnType<typeof loadReceipt>>>;
  copy: "Customer copy" | "Branch copy";
}) {
  const { order, branch, items } = data;
  const status =
    order.status === "cancelled" ? "Cancelled" : order.paidAt ? `Paid at the counter · ${formatDateTime(order.paidAt)}` : "Unpaid · pay at pickup";

  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <div className="mb-6 flex justify-end gap-2 print:hidden">
        <a href={`/api/receipts/${order.id}`} download className={buttonPrimary}>
          Download PDF
        </a>
        <PrintButton label="Print" />
      </div>
      <article className="rounded-2xl border border-line bg-card p-6 font-mono text-sm print:border-0 print:p-0">
        <header className="text-center">
          <p className="font-display text-2xl font-semibold not-italic">Brew Lab</p>
          <p className="mt-1">{branch.name}</p>
          <p className="text-muted">{branch.address}</p>
          <p className="mt-3 text-xs uppercase tracking-widest text-muted">Order receipt · {copy}</p>
        </header>

        <dl className="mt-6 space-y-1 border-y border-dashed border-line py-3">
          <div className="flex justify-between">
            <dt>Receipt no.</dt>
            <dd>{receiptNumber(order.id)}</dd>
          </div>
          <div className="flex justify-between">
            <dt>Order</dt>
            <dd>#{order.id}</dd>
          </div>
          <div className="flex justify-between">
            <dt>Ordered</dt>
            <dd>{formatDateTime(order.createdAt)}</dd>
          </div>
          <div className="flex justify-between">
            <dt>Pickup name</dt>
            <dd>{order.pickupName}</dd>
          </div>
        </dl>

        <ul className="mt-3 space-y-3">
          {items.map((item) => (
            <li key={item.id}>
              <div className="flex justify-between gap-4">
                <span>
                  {item.quantity} × {item.drinkName}
                </span>
                <span className="tabular-nums">{formatCents(item.unitPriceCents * item.quantity)}</span>
              </div>
              <p className="text-xs text-muted">{item.summary}</p>
              {item.quantity > 1 && <p className="text-xs text-muted">@ {formatCents(item.unitPriceCents)} each</p>}
            </li>
          ))}
        </ul>
        {order.note && <p className="mt-3 text-xs">Note: {order.note}</p>}

        <div className="mt-4 flex justify-between border-t border-dashed border-line pt-3 text-base font-semibold">
          <span>Total</span>
          <span className="tabular-nums">{formatCents(order.totalCents)}</span>
        </div>
        <p className="mt-1 text-xs">{status}</p>

        <footer className="mt-6 text-center text-xs text-muted">
          <p>Thank you for choosing Brew Lab!</p>
          <p className="mt-2">This is an order receipt, not a BIR official receipt or sales invoice.</p>
        </footer>
      </article>
    </div>
  );
}

import type { ReactNode } from "react";
import type { BoardOrder } from "@/lib/order-board";
import { formatCents } from "@/lib/drink";
import { Badge } from "./ui";

const minutesAgo = (d: Date) => {
  const m = Math.max(0, Math.round((Date.now() - d.getTime()) / 60_000));
  return m < 1 ? "just now" : m < 60 ? `${m} min ago` : `${Math.floor(m / 60)} h ${m % 60} min ago`;
};

/** One order on a live board: what to make, who's making it, and a slot for buttons. */
export function OrderCard({ order, children, highlight }: { order: BoardOrder; children?: ReactNode; highlight?: boolean }) {
  return (
    <li
      className={`rounded-2xl border bg-card p-4 ${
        order.stuck ? "border-red-400 ring-2 ring-red-400/30" : highlight ? "border-accent ring-2 ring-accent/30" : "border-line"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold">
          #{order.id} · {order.pickupName}
        </p>
        <div className="flex items-center gap-1.5">
          {order.stuck && <Badge status="cancelled" label="Stuck?" />}
          <Badge status={order.paidAt ? "paid" : "unpaid"} />
        </div>
      </div>
      <p className="text-xs text-muted">
        Ordered {minutesAgo(order.createdAt)}
        {order.makerName && order.claimedAt && (
          <>
            {" · "}
            <span className="font-medium text-foreground">{order.makerName}</span> since {minutesAgo(order.claimedAt)}
          </>
        )}
      </p>
      <ul className="mt-2 space-y-0.5 text-sm">
        {order.items.map((i) => (
          <li key={i.id}>
            <span className="font-medium">
              {i.quantity} × {i.drinkName}
            </span>{" "}
            <span className="text-muted">— {i.summary}</span>
          </li>
        ))}
      </ul>
      {order.note && <p className="mt-2 rounded-lg bg-accent-soft px-3 py-1.5 text-sm">Note: {order.note}</p>}
      {order.discountCents > 0 && <p className="mt-1 text-xs text-muted">Free drink with {order.coinsUsed} bean coins (already off the total)</p>}
      <div className="mt-3 flex flex-wrap items-end justify-between gap-2">
        <span className="font-display text-lg font-semibold tabular-nums">{formatCents(order.totalCents)}</span>
        {children}
      </div>
    </li>
  );
}

import type { Metadata } from "next";
import { and, desc, eq, gte, inArray, or, sql } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { orderItems, orders } from "@/db/schema";
import { AutoRefresh } from "@/components/auto-refresh";
import { Badge, cardClass, formatDateTime } from "@/components/ui";
import { getManagedBranch } from "@/lib/branch-access";
import { formatCents } from "@/lib/drink";
import { requireUser } from "@/lib/session";
import { BranchHeader } from "../branch-header";
import { OrderActions } from "./order-actions";

export const metadata: Metadata = { title: "Orders" };

export default async function BranchOrdersPage({ params }: PageProps<"/branch/[branchId]/orders">) {
  const { branchId } = await params;
  const user = await requireUser(`/branch/${branchId}/orders`);
  const branch = await getManagedBranch(Number(branchId), user);
  if (!branch) notFound();

  // Open orders, plus anything finished in the last 12 hours.
  const rows = await db
    .select()
    .from(orders)
    .where(
      and(
        eq(orders.branchId, branch.id),
        or(inArray(orders.status, ["placed", "preparing", "ready"]), gte(orders.updatedAt, sql`now() - interval '12 hours'`)),
      ),
    )
    .orderBy(desc(orders.createdAt))
    .limit(100);
  const items = rows.length
    ? await db.select().from(orderItems).where(inArray(orderItems.orderId, rows.map((o) => o.id)))
    : [];

  const open = rows.filter((o) => ["placed", "preparing", "ready"].includes(o.status));
  const done = rows.filter((o) => !open.includes(o));

  const renderOrder = (o: (typeof rows)[number]) => (
    <li key={o.id} className={cardClass}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-semibold">
          #{o.id} · {o.pickupName}
        </p>
        <div className="flex items-center gap-2">
          <Badge status={o.status} />
          <Badge status={o.paidAt ? "paid" : "unpaid"} />
        </div>
      </div>
      <p className="text-sm text-muted">{formatDateTime(o.createdAt)}</p>
      <ul className="mt-3 space-y-1 text-sm">
        {items
          .filter((i) => i.orderId === o.id)
          .map((i) => (
            <li key={i.id}>
              <span className="font-medium">
                {i.quantity} × {i.drinkName}
              </span>{" "}
              <span className="text-muted">— {i.summary}</span>
            </li>
          ))}
      </ul>
      {o.note && <p className="mt-2 rounded-lg bg-accent-soft px-3 py-2 text-sm">Note: {o.note}</p>}
      {o.discountCents > 0 && (
        <p className="mt-2 text-sm">
          Free drink with {o.coinsUsed} bean coins: −{formatCents(o.discountCents)} (already taken off the total)
        </p>
      )}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <span className="flex items-baseline gap-3">
          <span className="font-display text-xl font-semibold tabular-nums">{formatCents(o.totalCents)}</span>
          <a href={`/api/receipts/${o.id}`} download className="text-sm text-accent hover:underline">
            Receipt PDF
          </a>
        </span>
        <OrderActions orderId={o.id} status={o.status} paid={Boolean(o.paidAt)} />
      </div>
    </li>
  );

  return (
    <div>
      <AutoRefresh seconds={20} />
      <BranchHeader branch={branch} />
      <h2 className="mb-4 text-lg font-semibold">Open orders ({open.length})</h2>
      {open.length === 0 ? (
        <p className="text-muted">No open orders right now. New orders appear here automatically.</p>
      ) : (
        <ul className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-2">{open.map(renderOrder)}</ul>
      )}
      {done.length > 0 && (
        <>
          <h2 className="mb-4 mt-10 text-lg font-semibold">Finished in the last 12 hours</h2>
          <ul className="grid grid-cols-[minmax(0,1fr)] gap-4 opacity-80 md:grid-cols-2">{done.map(renderOrder)}</ul>
        </>
      )}
    </div>
  );
}

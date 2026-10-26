import type { Metadata } from "next";
import { desc, eq } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/db";
import { branches, orders } from "@/db/schema";
import { Badge, cardClass, formatDateTime, PageTitle } from "@/components/ui";
import { formatCents } from "@/lib/drink";
import { requireRole } from "@/lib/session";

export const metadata: Metadata = { title: "Your orders" };

export default async function OrdersPage() {
  const user = await requireRole(["customer"], "/orders");
  const rows = await db
    .select({
      id: orders.id,
      status: orders.status,
      totalCents: orders.totalCents,
      createdAt: orders.createdAt,
      branchName: branches.name,
    })
    .from(orders)
    .innerJoin(branches, eq(orders.branchId, branches.id))
    .where(eq(orders.userId, user.id))
    .orderBy(desc(orders.createdAt))
    .limit(50);

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <PageTitle title="Your orders" />
      {rows.length === 0 ? (
        <div className={cardClass}>
          No orders yet.{" "}
          <Link href="/menu" className="font-medium text-accent">
            Order something →
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map((o) => (
            <li key={o.id}>
              <Link href={`/orders/${o.id}`} className={`${cardClass} flex items-center justify-between gap-4 hover:border-accent`}>
                <div>
                  <p className="font-medium">
                    Order #{o.id} · {o.branchName}
                  </p>
                  <p className="text-sm text-muted">{formatDateTime(o.createdAt)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="tabular-nums">{formatCents(o.totalCents)}</span>
                  <Badge status={o.status} />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

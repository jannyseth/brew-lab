import type { Metadata } from "next";
import { and, eq } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/db";
import { branches, employees } from "@/db/schema";
import { AutoRefresh } from "@/components/auto-refresh";
import { WorkerOrderButtons } from "@/components/order-buttons";
import { OrderCard } from "@/components/order-card";
import { ShiftProgress } from "@/components/shift-progress";
import { cardClass, formatDateTime, PageTitle } from "@/components/ui";
import { formatCents } from "@/lib/drink";
import { isUpForGrabs, madeBy, onShift, openOrders } from "@/lib/order-board";
import { requireRole } from "@/lib/session";

export const metadata: Metadata = { title: "Order board" };

/**
 * The worker's live board: call dibs on a waiting order, make it, mark it ready.
 * Only someone clocked in at the branch can take orders.
 */
export default async function WorkOrdersPage() {
  const user = await requireRole(["worker"], "/work/orders");
  const jobs = await db
    .select({ employeeId: employees.id, branchId: branches.id, branchName: branches.name, target: branches.shiftOrderTarget })
    .from(employees)
    .innerJoin(branches, eq(employees.branchId, branches.id))
    .where(and(eq(employees.userId, user.id), eq(employees.active, true), eq(branches.status, "approved")));

  const boards = await Promise.all(
    jobs.map(async (j) => {
      const [team, open] = await Promise.all([onShift(j.branchId), openOrders(j.branchId)]);
      const shift = team.find((p) => p.employeeId === j.employeeId);
      return { ...j, shift, open, doneThisShift: shift?.done ?? 0 };
    }),
  );
  const receipts = await madeBy(jobs.map((j) => j.employeeId));
  // Most workers have one branch; put the one they're clocked in at first.
  boards.sort((a, b) => Number(Boolean(b.shift)) - Number(Boolean(a.shift)));

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <AutoRefresh seconds={6} />
      <PageTitle title="Order board" subtitle="First to tap Dibs makes the order. Mark it ready when it's done." />
      <p className="-mt-4 mb-6 text-sm">
        <Link href="/work" className="text-accent hover:underline">
          ← Work home
        </Link>
      </p>

      {boards.length === 0 && <p className={cardClass}>You&apos;re not on a team yet. Ask a branch for an invite link.</p>}

      {boards.map((b) => {
        const onShift = Boolean(b.shift);
        const mine = b.open.filter((o) => o.makerId === b.employeeId && o.status === "preparing");
        const grabs = b.open.filter(isUpForGrabs);
        const ready = b.open.filter((o) => o.status === "ready");
        const sections = [
          { title: "Yours", empty: "Nothing yet. Call dibs on an order below.", orders: mine },
          { title: "Up for grabs", empty: "All caught up. New orders show up here by themselves.", orders: grabs },
          { title: "Ready for pickup", empty: "Nothing waiting at the counter.", orders: ready },
        ];
        return (
          <section key={b.employeeId} className="mb-12">
            {boards.length > 1 && <h2 className="mb-3 font-display text-2xl font-semibold">{b.branchName}</h2>}
            {onShift ? (
              <div className={`${cardClass} mb-6`}>
                <ShiftProgress done={b.doneThisShift} target={b.target} />
              </div>
            ) : (
              <p className="mb-6 rounded-2xl bg-amber-100 px-4 py-3 text-sm text-amber-900 dark:bg-amber-900/40 dark:text-amber-200">
                You&apos;re off the clock at {b.branchName}. Scan the QR code on the counter screen to start your shift and take orders.
              </p>
            )}
            {sections.map((s) => (
              <div key={s.title} className="mb-8">
                <h3 className="mb-3 text-lg font-semibold">
                  {s.title} <span className="text-sm font-normal text-muted">· {s.orders.length}</span>
                </h3>
                {s.orders.length === 0 ? (
                  <p className="rounded-2xl border border-dashed border-line px-4 py-5 text-center text-sm text-muted">{s.empty}</p>
                ) : (
                  <ul className="space-y-3">
                    {s.orders.map((o) => (
                      <OrderCard key={o.id} order={o} highlight={o.makerId === b.employeeId && o.status === "preparing"}>
                        {onShift && (
                          <WorkerOrderButtons
                            orderId={o.id}
                            status={o.status}
                            paid={Boolean(o.paidAt)}
                            mine={o.makerId === b.employeeId}
                            upForGrabs={isUpForGrabs(o)}
                          />
                        )}
                      </OrderCard>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </section>
        );
      })}

      {receipts.length > 0 && (
        <>
          <h2 className="mb-3 text-lg font-semibold">Orders you made</h2>
          <ul className="divide-y divide-line rounded-2xl border border-line bg-card text-sm">
            {receipts.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
                <span>
                  #{r.id} <span className="text-muted">· {r.completedAt ? formatDateTime(r.completedAt) : ""}</span>
                </span>
                <span className="flex items-center gap-3">
                  <span className="tabular-nums">{formatCents(r.totalCents)}</span>
                  <Link href={`/work/receipts/${r.id}`} className="text-accent hover:underline">
                    Receipt
                  </Link>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

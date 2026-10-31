import type { Metadata } from "next";
import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { employees, orders } from "@/db/schema";
import { ActionForm } from "@/components/action-form";
import { AutoRefresh } from "@/components/auto-refresh";
import { Avatar } from "@/components/avatar";
import { AssignOrder } from "@/components/order-buttons";
import { OrderCard } from "@/components/order-card";
import { ShiftProgress } from "@/components/shift-progress";
import { Badge, cardClass, formatDateTime, inputClass } from "@/components/ui";
import { setShiftTarget } from "@/app/actions/orders";
import { getManagedBranch } from "@/lib/branch-access";
import { formatCents } from "@/lib/drink";
import { isUpForGrabs, onShift, openOrders, STUCK_MINUTES } from "@/lib/order-board";
import { requireUser } from "@/lib/session";
import { BranchHeader } from "../branch-header";
import { OrderActions } from "./order-actions";

export const metadata: Metadata = { title: "Orders" };

const timeOnly = (d: Date) =>
  new Intl.DateTimeFormat("en-PH", { timeStyle: "short", timeZone: process.env.NEXT_PUBLIC_TIMEZONE || undefined }).format(d);

/**
 * The live order board. Workers on shift call dibs from their phones; the owner
 * watches here and steps in when nobody's on, or an order is stuck.
 */
export default async function BranchOrdersPage({ params }: PageProps<"/branch/[branchId]/orders">) {
  const { branchId } = await params;
  const user = await requireUser(`/branch/${branchId}/orders`);
  const branch = await getManagedBranch(Number(branchId), user);
  if (!branch) notFound();

  const [open, team, done] = await Promise.all([
    openOrders(branch.id),
    onShift(branch.id),
    db
      .select({ order: orders, makerName: employees.name })
      .from(orders)
      .leftJoin(employees, eq(orders.makerId, employees.id))
      .where(
        and(
          eq(orders.branchId, branch.id),
          inArray(orders.status, ["completed", "cancelled"]),
          gte(orders.updatedAt, sql`now() - interval '12 hours'`),
        ),
      )
      .orderBy(desc(orders.updatedAt))
      .limit(50),
  ]);

  // With nobody on the clock the owner is the one making orders, so the buttons are out in the open.
  const ownerOnly = team.length === 0;
  const pickable = team.map((p) => ({ employeeId: p.employeeId, name: p.name }));
  const columns = [
    { title: "Up for grabs", hint: "Waiting for someone to call dibs", orders: open.filter(isUpForGrabs) },
    { title: "Being made", hint: "Someone has dibs", orders: open.filter((o) => o.status === "preparing") },
    { title: "Ready for pickup", hint: "Anyone on shift can hand these over", orders: open.filter((o) => o.status === "ready") },
  ];
  const stuck = open.filter((o) => o.stuck).length;

  return (
    <div>
      <AutoRefresh seconds={8} />
      <BranchHeader branch={branch} />

      <section className="mb-6">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="text-lg font-semibold">
            On the clock <span className="text-sm font-normal text-muted">· {team.length}</span>
          </h2>
          <details className="text-sm">
            <summary className="cursor-pointer font-medium text-accent">
              Shift target: {branch.shiftOrderTarget ? `${branch.shiftOrderTarget} orders` : "none"}
            </summary>
            <ActionForm action={setShiftTarget.bind(null, branch.id)} submitLabel="Save target" className={`${cardClass} mt-2 max-w-xs space-y-2`}>
              <label className="block text-sm font-medium">
                Orders per worker, per shift
                <input
                  name="target"
                  type="number"
                  min="1"
                  max="500"
                  defaultValue={branch.shiftOrderTarget ?? ""}
                  placeholder="No target"
                  className={inputClass}
                />
              </label>
              <p className="text-xs text-muted">A goal shown on everyone&apos;s board. Nobody is stopped when they reach it.</p>
            </ActionForm>
          </details>
        </div>

        {ownerOnly ? (
          <p className="rounded-2xl bg-amber-100 px-4 py-3 text-sm text-amber-900 dark:bg-amber-900/40 dark:text-amber-200">
            No one is clocked in, so the orders are yours. The buttons on each order are open. Once a worker scans in at the counter, they can call dibs.
          </p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {team.map((p) => {
              const theirs = open.filter((o) => o.makerId === p.employeeId);
              const busy = theirs.some((o) => o.status === "preparing");
              return (
                <li key={p.employeeId}>
                  <details className="group">
                    <summary className="flex cursor-pointer list-none items-center gap-2 rounded-full border border-line bg-card py-1.5 pl-1.5 pr-3 hover:border-accent group-open:border-accent">
                      <Avatar src={p.image} name={p.name} size={28} />
                      <span className="text-sm font-medium">{p.name}</span>
                      <span
                        className={`h-2 w-2 rounded-full ${busy ? "bg-sky-500" : "bg-emerald-500"}`}
                        aria-label={busy ? "Making an order" : "Free"}
                      />
                    </summary>
                    <div className={`${cardClass} mt-2 w-72 space-y-3 text-sm`}>
                      <p className="text-muted">
                        {p.position} · on since {timeOnly(p.since)}
                      </p>
                      <p className="font-medium">
                        {busy ? `Making ${theirs.filter((o) => o.status === "preparing").map((o) => `#${o.id}`).join(", ")}` : "Free right now"}
                      </p>
                      {theirs.some((o) => o.status === "ready") && (
                        <p className="text-muted">Ready, waiting for pickup: {theirs.filter((o) => o.status === "ready").map((o) => `#${o.id}`).join(", ")}</p>
                      )}
                      <ShiftProgress done={p.done} target={branch.shiftOrderTarget} />
                    </div>
                  </details>
                </li>
              );
            })}
          </ul>
        )}
        {stuck > 0 && (
          <p className="mt-3 text-sm font-medium text-red-600">
            {stuck} order{stuck === 1 ? " hasn't" : "s haven't"} moved in over {STUCK_MINUTES} minutes. Check in, or give it to someone else.
          </p>
        )}
      </section>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-3">
        {columns.map((col) => (
          <section key={col.title}>
            <h2 className="text-lg font-semibold">
              {col.title} <span className="text-sm font-normal text-muted">· {col.orders.length}</span>
            </h2>
            <p className="mb-3 text-xs text-muted">{col.hint}</p>
            {col.orders.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-line px-4 py-6 text-center text-sm text-muted">Nothing here.</p>
            ) : (
              <ul className="space-y-3">
                {col.orders.map((o) => {
                  const controls = (
                    <div className="flex w-full flex-col items-end gap-2">
                      {o.status !== "ready" && pickable.length > 0 && (
                        <AssignOrder
                          orderId={o.id}
                          makerId={o.makerId}
                          team={
                            o.makerId && !pickable.some((p) => p.employeeId === o.makerId)
                              ? [...pickable, { employeeId: o.makerId, name: o.makerName ?? "Former worker" }]
                              : pickable
                          }
                        />
                      )}
                      <OrderActions orderId={o.id} status={o.status} paid={Boolean(o.paidAt)} />
                    </div>
                  );
                  return (
                    <OrderCard key={o.id} order={o}>
                      {o.status === "preparing" && !o.makerId && <span className="text-xs font-medium text-accent">You&apos;re making this</span>}
                      {ownerOnly ? (
                        controls
                      ) : (
                        <details className="w-full text-right" open={o.stuck}>
                          <summary className="cursor-pointer list-none text-sm font-medium text-accent">Step in</summary>
                          <div className="mt-2">{controls}</div>
                        </details>
                      )}
                    </OrderCard>
                  );
                })}
              </ul>
            )}
          </section>
        ))}
      </div>

      {done.length > 0 && (
        <details className={`${cardClass} mt-10`}>
          <summary className="cursor-pointer font-semibold">Finished in the last 12 hours · {done.length}</summary>
          <ul className="mt-3 divide-y divide-line text-sm">
            {done.map(({ order: o, makerName }) => (
              <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>
                  #{o.id} · {o.pickupName} <span className="text-muted">· {formatDateTime(o.updatedAt)}</span>
                  {makerName && <span className="text-muted"> · made by {makerName}</span>}
                </span>
                <span className="flex items-center gap-3">
                  <Badge status={o.status} />
                  <span className="tabular-nums">{formatCents(o.totalCents)}</span>
                  <a href={`/branch/${branch.id}/orders/${o.id}/receipt`} className="text-accent hover:underline">
                    Receipt
                  </a>
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

import "server-only";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { branches, employees, orderItems, orders } from "@/db/schema";
import { receiptNumber } from "@/components/receipt";
import { dailySales, feeFor, type Scope } from "./analytics";
import type { SheetSpec } from "./sheets";
import { sheetDate } from "./sheets";

const statusLabel = (status: string) => status[0].toUpperCase() + status.slice(1);

/** Orders and their items for a set of branches, newest first. */
export async function salesSheets(scope: Scope, opts: { includePickupNames: boolean; days?: number }): Promise<SheetSpec[]> {
  const days = opts.days ?? 365;
  const where = and(
    scope === "all" ? undefined : inArray(orders.branchId, scope.length ? scope : [-1]),
    sql`${orders.createdAt} >= now() - make_interval(days => ${days})`,
  );
  const orderRows = await db
    .select({ order: orders, branchName: branches.name, makerName: employees.name })
    .from(orders)
    .innerJoin(branches, eq(orders.branchId, branches.id))
    .leftJoin(employees, eq(orders.makerId, employees.id))
    .where(where)
    .orderBy(desc(orders.createdAt));
  const ids = orderRows.map((o) => o.order.id);
  const items = ids.length
    ? await db.select().from(orderItems).where(inArray(orderItems.orderId, ids))
    : [];
  const byId = new Map(orderRows.map((o) => [o.order.id, o]));
  const daily = await dailySales(scope, Math.min(days, 366));

  const sales = (o: (typeof orderRows)[number]["order"]) => (o.paidAt && o.status !== "cancelled" ? o.totalCents : 0);

  return [
    {
      name: "Daily summary",
      columns: [
        { header: "Date", key: "day", width: 14 },
        { header: "Paid orders", key: "orders" },
        { header: "Paid sales", key: "sales", money: true, width: 16 },
        { header: "Brew Lab fee (30%)", key: "fee", money: true, width: 20 },
        { header: "Net to branch", key: "net", money: true, width: 16 },
      ],
      rows: [...daily].reverse().map((d) => ({ ...d, fee: feeFor(d.sales), net: d.sales - feeFor(d.sales) })),
      note: "Paid sales = orders marked paid and not cancelled, by the day they were paid (Philippine time).",
    },
    {
      name: "Orders",
      columns: [
        { header: "Receipt no.", key: "receipt", width: 12 },
        { header: "Order", key: "id", width: 8 },
        { header: "Branch", key: "branch", width: 22 },
        { header: "Placed", key: "placed", date: true, width: 18 },
        ...(opts.includePickupNames ? [{ header: "Pickup name", key: "pickup", width: 18 }] : []),
        { header: "Items", key: "items", width: 8 },
        { header: "Total", key: "total", money: true, width: 14 },
        { header: "Status", key: "status", width: 12 },
        { header: "Paid at", key: "paidAt", date: true, width: 18 },
        { header: "Counted as sale", key: "sale", money: true, width: 16 },
        { header: "Made by", key: "maker", width: 18 },
      ],
      rows: orderRows.map(({ order, branchName, makerName }) => ({
        receipt: receiptNumber(order.id),
        id: order.id,
        branch: branchName,
        placed: sheetDate(order.createdAt),
        pickup: order.pickupName,
        items: items.filter((i) => i.orderId === order.id).reduce((n, i) => n + i.quantity, 0),
        total: order.totalCents,
        status: statusLabel(order.status),
        paidAt: sheetDate(order.paidAt),
        sale: sales(order),
        maker: makerName ?? (order.status === "completed" ? "Owner" : ""),
      })),
    },
    {
      name: "Items sold",
      columns: [
        { header: "Order", key: "orderId", width: 8 },
        { header: "Branch", key: "branch", width: 22 },
        { header: "Drink", key: "drink", width: 22 },
        { header: "Customization", key: "summary", width: 60 },
        { header: "Qty", key: "qty", width: 6 },
        { header: "Unit price", key: "unit", money: true, width: 14 },
        { header: "Line total", key: "line", money: true, width: 14 },
        { header: "Order status", key: "status", width: 12 },
      ],
      rows: items.map((i) => {
        const o = byId.get(i.orderId)!;
        return {
          orderId: i.orderId,
          branch: o.branchName,
          drink: i.drinkName,
          summary: i.summary,
          qty: i.quantity,
          unit: i.unitPriceCents,
          line: i.unitPriceCents * i.quantity,
          status: statusLabel(o.order.status),
        };
      }),
    },
  ];
}

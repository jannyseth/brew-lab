import { db } from "@/db";
import { feeSettlements } from "@/db/schema";
import { activityByHour, branchMonthlySales, currentMonth, feeFor, salesByBranch, topDrinks } from "@/lib/analytics";
import { logActivity } from "@/lib/audit";
import { commonCombinations, idealProfile, ingredientPopularity, popularRecipes } from "@/lib/dataset";
import { salesSheets } from "@/lib/exports";
import { getSession } from "@/lib/session";
import { fileDate, workbookResponse, type SheetSpec } from "@/lib/sheets";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// Admin downloads: sales (all branches), earnings (30% fees) and the anonymous dataset.
export async function GET(_: Request, { params }: RouteContext<"/api/exports/admin/[report]">) {
  const session = await getSession();
  if (session?.user.role !== "super_admin") return new Response("Not found", { status: 404 });
  const report = (await params).report;

  let sheets: SheetSpec[];
  if (report === "sales") {
    const byBranch = await salesByBranch("all");
    sheets = [
      {
        name: "By branch",
        columns: [
          { header: "Branch", key: "name", width: 24 },
          { header: "Paid orders (month)", key: "monthOrders", width: 20 },
          { header: "Sales (month)", key: "month", money: true, width: 16 },
          { header: "Sales (year)", key: "year", money: true, width: 16 },
          { header: "Brew Lab 30% (year)", key: "fee", money: true, width: 20 },
        ],
        rows: byBranch.map((b) => ({ ...b, fee: feeFor(b.year) })),
      },
      // Customers' pickup names are left out of the admin export.
      ...(await salesSheets("all", { includePickupNames: false })),
    ];
  } else if (report === "earnings") {
    const [rows, settled, thisMonth] = await Promise.all([branchMonthlySales(24), db.select().from(feeSettlements), currentMonth()]);
    const paid = new Map(settled.map((s) => [`${s.branchId}:${s.month}`, s]));
    sheets = [
      {
        name: "Fees by month",
        columns: [
          { header: "Month", key: "month", width: 10 },
          { header: "Branch", key: "branch", width: 24 },
          { header: "Paid sales", key: "sales", money: true, width: 16 },
          { header: "Fee (30%)", key: "fee", money: true, width: 14 },
          { header: "Status", key: "status", width: 16 },
          { header: "Marked paid on", key: "paidAt", width: 16 },
        ],
        rows: rows.map((r) => {
          const s = paid.get(`${r.branch_id}:${r.month}`);
          return {
            month: r.month,
            branch: r.branch_name,
            sales: s?.salesCents ?? r.sales,
            fee: s?.feeCents ?? feeFor(r.sales),
            status: s ? "Paid" : r.month === thisMonth ? "Month in progress" : "Unpaid",
            paidAt: s ? s.paidAt.toISOString().slice(0, 10) : "",
          };
        }),
        note: "Each branch pays Brew Lab 30% of its paid sales.",
      },
    ];
  } else if (report === "dataset") {
    const [ingredients, combos, recipes, activity, menu] = await Promise.all([
      ingredientPopularity(),
      commonCombinations(50),
      popularRecipes(50),
      activityByHour("all", 365),
      topDrinks("all", "all", 50),
    ]);
    const note = "Anonymous, aggregated data: contains no names, emails or other personal information.";
    sheets = [
      {
        name: "Ideal coffee",
        columns: [
          { header: "Category", key: "group_name", width: 18 },
          { header: "Most chosen", key: "name", width: 22 },
          { header: "Cups", key: "cups" },
        ],
        rows: idealProfile(ingredients),
        note,
      },
      {
        name: "Ingredients",
        columns: [
          { header: "Category", key: "group_name", width: 18 },
          { header: "Option", key: "name", width: 22 },
          { header: "Cups", key: "cups" },
          { header: "Units (shots, pumps…)", key: "units", width: 22 },
        ],
        rows: ingredients,
        note,
      },
      {
        name: "Combinations",
        columns: [
          { header: "Add-on", key: "first", width: 22 },
          { header: "Together with", key: "second", width: 22 },
          { header: "Cups", key: "cups" },
        ],
        rows: combos,
        note,
      },
      {
        name: "Popular recipes",
        columns: [
          { header: "Drink", key: "drink", width: 22 },
          { header: "Recipe", key: "summary", width: 70 },
          { header: "Cups", key: "cups" },
        ],
        rows: recipes,
        note,
      },
      {
        name: "Menu items",
        columns: [
          { header: "Drink", key: "name", width: 24 },
          { header: "Cups", key: "cups" },
          { header: "Sales", key: "sales", money: true, width: 16 },
        ],
        rows: menu,
        note,
      },
      {
        name: "Activity",
        columns: [
          { header: "Day", key: "day", width: 12 },
          { header: "Hour", key: "hour" },
          { header: "Orders", key: "orders" },
        ],
        rows: activity
          .sort((a, b) => a.dow - b.dow || a.hour - b.hour)
          .map((a) => ({ day: DAYS[a.dow], hour: `${String(a.hour).padStart(2, "0")}:00`, orders: a.orders })),
        note: `${note} Times are Philippine time, last 12 months.`,
      },
    ];
  } else {
    return new Response("Not found", { status: 404 });
  }

  await logActivity({ userId: session.user.id, userEmail: session.user.email, action: `export.${report}` });
  return workbookResponse(`brew-lab-${report}-${fileDate()}.xlsx`, sheets);
}

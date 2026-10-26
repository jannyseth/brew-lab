import "server-only";
import { and, count, eq, gt, gte, isNotNull, lt, lte, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { branches, branchLicenses, orders } from "@/db/schema";
import { logActivity } from "./audit";

/** ₱100,000 in centavos: paid sales needed during a license year to renew it. */
export const LICENSE_QUOTA_CENTS = 100_000_00;

const addOneYear = (date: Date) => {
  const next = new Date(date);
  next.setFullYear(next.getFullYear() + 1);
  return next;
};

/** Paid, non-cancelled sales for a branch in [from, to). */
export async function branchSalesBetween(branchId: number, from: Date, to: Date) {
  const [row] = await db
    .select({ total: sql<number>`coalesce(sum(${orders.totalCents}), 0)::int` })
    .from(orders)
    .where(
      and(
        eq(orders.branchId, branchId),
        isNotNull(orders.paidAt),
        ne(orders.status, "cancelled"),
        gte(orders.paidAt, from),
        lt(orders.paidAt, to),
      ),
    );
  return row.total;
}

export async function issueLicense(branchId: number, issuedAt = new Date()) {
  const [{ n }] = await db.select({ n: count() }).from(branchLicenses).where(eq(branchLicenses.branchId, branchId));
  // e.g. BL-0007-02: branch 7's second license.
  const licenseNumber = `BL-${String(branchId).padStart(4, "0")}-${String(n + 1).padStart(2, "0")}`;
  const [license] = await db
    .insert(branchLicenses)
    .values({ branchId, licenseNumber, issuedAt, expiresAt: addOneYear(issuedAt), quotaCents: LICENSE_QUOTA_CENTS })
    .returning();
  return license;
}

/**
 * Settles every license that has reached its expiry date: renews it for a
 * year if the quota was met, otherwise marks it expired (the branch then
 * disappears from checkout until the super admin issues a new license).
 * Runs on demand whenever licenses matter, so no scheduled job is needed.
 */
export async function settleExpiredLicenses() {
  const due = await db
    .select()
    .from(branchLicenses)
    .where(and(eq(branchLicenses.status, "active"), lte(branchLicenses.expiresAt, sql`now()`)));

  for (const license of due) {
    const sales = await branchSalesBetween(license.branchId, license.issuedAt, license.expiresAt);
    const met = sales >= license.quotaCents;
    // The status condition makes this safe if two requests settle at the same time.
    const [settled] = await db
      .update(branchLicenses)
      .set({ status: met ? "renewed" : "expired", salesCents: sales, evaluatedAt: new Date() })
      .where(and(eq(branchLicenses.id, license.id), eq(branchLicenses.status, "active")))
      .returning({ id: branchLicenses.id });
    if (!settled) continue;

    if (met) {
      const next = await issueLicense(license.branchId, license.expiresAt);
      await logActivity({
        action: "license.renewed",
        targetType: "branch",
        targetId: license.branchId,
        details: { from: license.licenseNumber, to: next.licenseNumber, salesCents: sales },
      });
    } else {
      await logActivity({
        action: "license.expired",
        targetType: "branch",
        targetId: license.branchId,
        details: { licenseNumber: license.licenseNumber, salesCents: sales, quotaCents: license.quotaCents },
      });
    }
  }
}

/** SQL condition: the branch has a license that is active right now. */
export const hasActiveLicense = sql`exists (
  select 1 from ${branchLicenses}
  where ${branchLicenses.branchId} = ${branches.id}
    and ${branchLicenses.status} = 'active'
    and ${branchLicenses.expiresAt} > now()
)`;

/** Branches customers can order from: approved, with a valid license. */
export const isOpenBranch = and(eq(branches.status, "approved"), hasActiveLicense);

export async function currentLicense(branchId: number) {
  const [license] = await db
    .select()
    .from(branchLicenses)
    .where(and(eq(branchLicenses.branchId, branchId), eq(branchLicenses.status, "active"), gt(branchLicenses.expiresAt, sql`now()`)))
    .limit(1);
  return license ?? null;
}

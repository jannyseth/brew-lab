"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath, updateTag } from "next/cache";
import { db } from "@/db";
import { branches, branchLicenses, feeSettlements, managerApplications, menuItems, signatureDrinks, user } from "@/db/schema";
import type { FormState } from "@/components/action-form";
import { branchMonthlySales, feeFor } from "@/lib/analytics";
import { logActivity } from "@/lib/audit";
import { deleteImage } from "@/lib/image-store";
import { currentLicense, issueLicense } from "@/lib/licenses";
import { getSession } from "@/lib/session";

type Decision = "approved" | "rejected";
const onlyAdmin: FormState = { ok: false, message: "Only the admin can do this." };

async function getAdmin() {
  const session = await getSession();
  return session?.user.role === "super_admin" ? { userId: session.user.id, userEmail: session.user.email } : null;
}

const clean = (note: string) => note.trim().slice(0, 300) || null;

export async function reviewOwner(applicationId: number, decision: Decision, note: string): Promise<FormState> {
  const admin = await getAdmin();
  if (!admin) return onlyAdmin;

  const [application] = await db
    .update(managerApplications)
    .set({ status: decision, reviewNote: clean(note), reviewedAt: new Date() })
    .where(and(eq(managerApplications.id, applicationId), eq(managerApplications.status, "pending")))
    .returning();
  if (!application) return { ok: false, message: "This application was already reviewed." };

  if (decision === "approved") {
    await db
      .update(user)
      .set({ role: "branch_manager" })
      .where(and(eq(user.id, application.userId), eq(user.role, "branch_applicant")));
  }
  await logActivity({
    ...admin,
    action: `owner.${decision}`,
    targetType: "application",
    targetId: applicationId,
    details: { ownerId: application.userId, note: clean(note) },
  });
  revalidatePath("/admin", "layout");
  return { ok: true, message: `Owner ${decision}.` };
}

export async function reviewBranch(branchId: number, decision: Decision, note: string): Promise<FormState> {
  const admin = await getAdmin();
  if (!admin) return onlyAdmin;

  const [branch] = await db
    .update(branches)
    .set({ status: decision, reviewNote: clean(note), reviewedAt: new Date() })
    .where(and(eq(branches.id, branchId), eq(branches.status, "pending")))
    .returning({ id: branches.id, name: branches.name });
  if (!branch) return { ok: false, message: "This branch was already reviewed." };

  // Approval issues the branch's first 1-year license, unless it still holds one (e.g. after a suspension).
  let licenseNumber: string | undefined;
  if (decision === "approved") {
    licenseNumber = (await currentLicense(branchId))?.licenseNumber ?? (await issueLicense(branchId)).licenseNumber;
  }
  await logActivity({
    ...admin,
    action: `branch.${decision}`,
    targetType: "branch",
    targetId: branchId,
    details: { name: branch.name, licenseNumber, note: clean(note) },
  });
  revalidatePath("/admin", "layout");
  return { ok: true, message: decision === "approved" ? `Branch approved. License ${licenseNumber} issued.` : "Branch rejected." };
}

/** Approves a customer's signature drink so it goes public, or rejects it. */
export async function reviewSignatureDrink(drinkId: number, decision: Decision, note: string): Promise<FormState> {
  const admin = await getAdmin();
  if (!admin) return onlyAdmin;
  const [drink] = await db
    .update(signatureDrinks)
    .set({ status: decision, reviewNote: clean(note), reviewedAt: new Date() })
    .where(and(eq(signatureDrinks.id, drinkId), eq(signatureDrinks.status, "pending")))
    .returning({ id: signatureDrinks.id, name: signatureDrinks.name, slug: signatureDrinks.slug });
  if (!drink) return { ok: false, message: "This drink was already reviewed." };
  await logActivity({
    ...admin,
    action: `signature.${decision}`,
    targetType: "signature_drink",
    targetId: drinkId,
    details: { name: drink.name, note: clean(note) },
  });
  revalidatePath("/admin", "layout");
  revalidatePath(`/d/${drink.slug}`);
  revalidatePath("/leaderboard");
  return { ok: true, message: decision === "approved" ? "Drink is now public." : "Drink rejected." };
}

/** Takes an approved branch offline again, e.g. if it closes. Its license is kept. */
export async function suspendBranch(branchId: number): Promise<FormState> {
  const admin = await getAdmin();
  if (!admin) return onlyAdmin;
  await db
    .update(branches)
    .set({ status: "pending", reviewNote: "Suspended by the admin", reviewedAt: new Date() })
    .where(eq(branches.id, branchId));
  await logActivity({ ...admin, action: "branch.suspended", targetType: "branch", targetId: branchId });
  revalidatePath("/admin", "layout");
  return { ok: true, message: "Branch hidden from customers." };
}

/** Issues a fresh 1-year license to a branch whose license expired without meeting the quota. */
export async function reissueLicense(branchId: number): Promise<FormState> {
  const admin = await getAdmin();
  if (!admin) return onlyAdmin;
  if (await currentLicense(branchId)) return { ok: false, message: "This branch already has an active license." };
  const [branch] = await db.select({ status: branches.status }).from(branches).where(eq(branches.id, branchId));
  if (branch?.status !== "approved") return { ok: false, message: "Only approved branches can be licensed." };

  const license = await issueLicense(branchId);
  await logActivity({
    ...admin,
    action: "license.issued",
    targetType: "branch",
    targetId: branchId,
    details: { licenseNumber: license.licenseNumber },
  });
  revalidatePath("/admin", "layout");
  return { ok: true, message: `License ${license.licenseNumber} issued.` };
}

export async function revokeLicense(licenseId: number): Promise<FormState> {
  const admin = await getAdmin();
  if (!admin) return onlyAdmin;
  const [license] = await db
    .update(branchLicenses)
    .set({ status: "revoked", evaluatedAt: new Date() })
    .where(and(eq(branchLicenses.id, licenseId), eq(branchLicenses.status, "active")))
    .returning();
  if (!license) return { ok: false, message: "This license isn't active." };
  await logActivity({
    ...admin,
    action: "license.revoked",
    targetType: "branch",
    targetId: license.branchId,
    details: { licenseNumber: license.licenseNumber },
  });
  revalidatePath("/admin", "layout");
  return { ok: true, message: `License ${license.licenseNumber} revoked.` };
}

const monthPattern = /^\d{4}-(0[1-9]|1[0-2])$/;

/** Records that a branch paid Brew Lab's fee for a month, with the amounts at that moment. */
export async function markFeePaid(branchId: number, month: string, paid: boolean): Promise<FormState> {
  const admin = await getAdmin();
  if (!admin) return onlyAdmin;
  if (!Number.isInteger(branchId) || !monthPattern.test(month)) return { ok: false, message: "Invalid month." };

  if (!paid) {
    await db.delete(feeSettlements).where(and(eq(feeSettlements.branchId, branchId), eq(feeSettlements.month, month)));
    await logActivity({ ...admin, action: "fee.unpaid", targetType: "branch", targetId: branchId, details: { month } });
    revalidatePath("/admin/earnings");
    return { ok: true, message: "Marked as unpaid." };
  }

  const sales = (await branchMonthlySales(24)).find((r) => r.branch_id === branchId && r.month === month)?.sales ?? 0;
  const feeCents = feeFor(sales);
  await db
    .insert(feeSettlements)
    .values({ branchId, month, salesCents: sales, feeCents, markedBy: admin.userId })
    .onConflictDoNothing();
  await logActivity({ ...admin, action: "fee.paid", targetType: "branch", targetId: branchId, details: { month, feeCents } });
  revalidatePath("/admin/earnings");
  return { ok: true, message: "Marked as paid." };
}

/** Goes back to the starter photo for a drink, deleting the uploaded one. */
export async function resetMenuPhoto(slug: string): Promise<FormState> {
  const admin = await getAdmin();
  if (!admin) return onlyAdmin;
  const [item] = await db.select({ key: menuItems.imageKey }).from(menuItems).where(eq(menuItems.slug, slug));
  if (!item?.key) return { ok: false, message: "This drink already uses its starter photo." };
  await db.update(menuItems).set({ imageKey: null }).where(eq(menuItems.slug, slug));
  await deleteImage(item.key);
  await logActivity({ ...admin, action: "menu.photo_reset", targetType: "menu_item", targetId: slug });
  updateTag("menu");
  revalidatePath("/admin/menu");
  return { ok: true, message: "Back to the starter photo." };
}

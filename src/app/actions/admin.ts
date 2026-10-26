"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { branches, branchLicenses, managerApplications, user } from "@/db/schema";
import type { FormState } from "@/components/action-form";
import { logActivity } from "@/lib/audit";
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
  revalidatePath("/admin");
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
  revalidatePath("/admin");
  return { ok: true, message: decision === "approved" ? `Branch approved. License ${licenseNumber} issued.` : "Branch rejected." };
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

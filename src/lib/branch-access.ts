import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { branches } from "@/db/schema";
import type { Role } from "./auth";
import { getSession } from "./session";

/** The branch, if this user owns it. Only its own verified branch owner may run it. */
export async function getManagedBranch(branchId: number, viewer: { id: string; role: Role }) {
  if (!Number.isInteger(branchId) || viewer.role !== "branch_manager") return null;
  const [branch] = await db.select().from(branches).where(eq(branches.id, branchId));
  return branch && branch.managerId === viewer.id ? branch : null;
}

/** For server actions: who is acting (for the activity log) and the branch, or null if not allowed. */
export async function authorizeBranch(branchId: number) {
  const session = await getSession();
  if (!session) return null;
  const branch = await getManagedBranch(branchId, { id: session.user.id, role: session.user.role as Role });
  return branch ? { viewer: { userId: session.user.id, userEmail: session.user.email }, branch } : null;
}

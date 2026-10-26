import { headers } from "next/headers";
import { db } from "@/db";
import { auditLogs } from "@/db/schema";

// The admin activity log: who signed in, and every change anyone makes.

export type AuditEntry = {
  userId?: string | null;
  userEmail?: string | null;
  action: string;
  targetType?: string;
  targetId?: string | number;
  details?: Record<string, unknown>;
  ipAddress?: string | null;
  userAgent?: string | null;
};

async function requestInfo() {
  try {
    const h = await headers();
    return {
      ipAddress: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip"),
      userAgent: h.get("user-agent"),
    };
  } catch {
    // Called outside a request (e.g. a background task).
    return { ipAddress: null, userAgent: null };
  }
}

/** Records an entry. Never throws: a logging failure must not break the action itself. */
export async function logActivity(entry: AuditEntry) {
  try {
    const info = entry.ipAddress === undefined ? await requestInfo() : { ipAddress: entry.ipAddress, userAgent: entry.userAgent };
    await db.insert(auditLogs).values({
      userId: entry.userId ?? null,
      userEmail: entry.userEmail ?? null,
      action: entry.action,
      targetType: entry.targetType ?? null,
      targetId: entry.targetId === undefined ? null : String(entry.targetId),
      details: entry.details ?? {},
      ipAddress: info.ipAddress ?? null,
      userAgent: info.userAgent ?? null,
    });
  } catch (err) {
    console.error("Failed to write audit log", err);
  }
}

import "server-only";
import type { Role } from "./auth";

// Limits that keep one account from flooding the inbox.
export const MAX_OPEN_TICKETS = 5;
export const SUBJECT_MAX = 120;
export const MESSAGE_MAX = 4000;

export const supportStaff: Role[] = ["super_admin", "support_agent"];

export function isSupportStaff(role: string | undefined) {
  return role === "super_admin" || role === "support_agent";
}

/** Absolute link for emails, which can't use relative paths. */
export function siteUrl(path: string) {
  const host = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  return host ? `https://${host}${path}` : `http://localhost:3000${path}`;
}

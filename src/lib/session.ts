import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import { auth, staffRoles, type Role } from "./auth";

// Every page and server action checks the session itself; there is no
// middleware to rely on, so a missing check can't be bypassed by routing.

export const getSession = cache(async () => {
  // Session checks read the clock (expiry), so they must always run per request.
  await connection();
  const session = await auth.api.getSession({ headers: await headers() });
  if (session && staffRoles.includes(session.user.role ?? "") && !session.user.twoFactorEnabled) {
    // Staff powers stay locked until two-factor sign-in is on, so every role check
    // (pages, server actions, API routes) fails closed without changing each one.
    return { ...session, user: { ...session.user, role: "needs_two_factor" as Role } };
  }
  return session;
});

export async function requireUser(returnTo = "/") {
  const session = await getSession();
  if (!session) redirect(`/sign-in?next=${encodeURIComponent(returnTo)}`);
  return session.user as typeof session.user & { role: Role };
}

/** For the sign-in and sign-up pages: someone already signed in goes on to where they were headed. */
export async function redirectIfSignedIn(next?: string | string[]) {
  if (!(await getSession())) return;
  const safe = typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : "/account";
  redirect(safe);
}

export async function requireRole(roles: Role[], returnTo = "/") {
  const user = await requireUser(returnTo);
  if (user.role === "needs_two_factor") redirect("/account/two-factor");
  // Wrong kind of account: send them to their own home instead.
  if (!roles.includes(user.role)) redirect("/account");
  return user;
}

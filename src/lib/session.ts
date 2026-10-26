import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import { auth, type Role } from "./auth";

// Every page and server action checks the session itself; there is no
// middleware to rely on, so a missing check can't be bypassed by routing.

export const getSession = cache(async () => {
  // Session checks read the clock (expiry), so they must always run per request.
  await connection();
  return auth.api.getSession({ headers: await headers() });
});

export async function requireUser(returnTo = "/") {
  const session = await getSession();
  if (!session) redirect(`/sign-in?next=${encodeURIComponent(returnTo)}`);
  return session.user as typeof session.user & { role: Role };
}

export async function requireRole(roles: Role[], returnTo = "/") {
  const user = await requireUser(returnTo);
  // Wrong kind of account: send them to their own home instead.
  if (!roles.includes(user.role)) redirect("/account");
  return user;
}

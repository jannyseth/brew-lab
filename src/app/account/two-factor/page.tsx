import type { Metadata } from "next";
import { and, eq, isNotNull } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/db";
import { account, user as users } from "@/db/schema";
import { cardClass, PageTitle } from "@/components/ui";
import { staffRoles } from "@/lib/auth";
import { requireUser } from "@/lib/session";
import { TwoFactorSetup } from "./two-factor-setup";

export const metadata: Metadata = { title: "Two-factor sign-in" };

export default async function TwoFactorPage() {
  const session = await requireUser("/account/two-factor");
  // The session reports locked staff as needs_two_factor, so read the stored role.
  const [[me], [credential]] = await Promise.all([
    db.select({ role: users.role, twoFactorEnabled: users.twoFactorEnabled }).from(users).where(eq(users.id, session.id)),
    db
      .select({ id: account.id })
      .from(account)
      .where(and(eq(account.userId, session.id), eq(account.providerId, "credential"), isNotNull(account.password))),
  ]);
  const staff = staffRoles.includes(me.role);
  const enabled = me.twoFactorEnabled === true;

  return (
    <div className="mx-auto max-w-xl px-4 py-12">
      <PageTitle
        title="Two-factor sign-in"
        subtitle="After your password, Brew Lab also asks for a code from an authenticator app on your phone."
      />

      {staff && !enabled && (
        <p className="mb-6 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-100">
          Brew Lab staff accounts must use two-factor sign-in. The admin area stays locked until you finish these steps.
        </p>
      )}

      <section className={cardClass}>
        {credential ? (
          <TwoFactorSetup enabled={enabled} staff={staff} />
        ) : (
          <>
            <h2 className="font-semibold">Set a password first</h2>
            <p className="mt-1 text-sm text-muted">
              Your account doesn&apos;t have a password yet. Two-factor sign-in is a password plus an app code, so set a
              password first. We&apos;ll email you a 6-digit code to confirm it&apos;s you.
            </p>
            <Link
              href="/forgot-password"
              className="mt-4 inline-block rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-accent-contrast hover:opacity-90"
            >
              Set a password
            </Link>
          </>
        )}
      </section>
    </div>
  );
}

import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/db";
import { user as users } from "@/db/schema";
import { updateName } from "@/app/actions/profile";
import { ActionForm } from "@/components/action-form";
import { ImageUpload } from "@/components/image-upload";
import { cardClass, formatDate, inputClass, PageTitle } from "@/components/ui";
import { requireUser } from "@/lib/session";
import { ConsentToggle } from "./consent-toggle";

export const metadata: Metadata = { title: "Your profile" };

const accountLabels: Record<string, string> = {
  customer: "Customer",
  branch_applicant: "Branch owner (waiting for verification)",
  branch_manager: "Verified branch owner",
  super_admin: "Administrator",
  support_agent: "Brew Lab support",
};

export default async function ProfilePage() {
  const session = await requireUser("/profile");
  const [me] = await db.select().from(users).where(eq(users.id, session.id));

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <PageTitle title="Your profile" subtitle={`${accountLabels[me.role] ?? me.role} · ${me.email}`} />

      <section className={cardClass}>
        <ImageUpload target={{ kind: "avatar" }} currentUrl={me.image} label="Profile picture" hint="JPG, PNG or WebP, up to 4 MB." />
      </section>

      <section className={`${cardClass} mt-6`}>
        <ActionForm action={updateName} submitLabel="Save name">
          <label className="block text-sm font-medium">
            Name
            <input name="name" required maxLength={80} defaultValue={me.name} className={inputClass} />
          </label>
        </ActionForm>
      </section>

      <section className={`${cardClass} mt-6`}>
        <h2 className="font-semibold">Two-factor sign-in</h2>
        <p className="mt-1 text-sm text-muted">
          {me.twoFactorEnabled
            ? "On. Signing in needs your password and a code from your authenticator app."
            : "Off. Add a code from your phone to your password so a stolen password isn't enough."}
        </p>
        <Link href="/account/two-factor" className="mt-3 inline-block text-sm font-medium text-accent">
          {me.twoFactorEnabled ? "Manage" : "Set up"}
        </Link>
      </section>

      {me.role === "customer" && (
        <section className={`${cardClass} mt-6`}>
          <h2 className="font-semibold">Personalized offers</h2>
          <p className="mt-1 text-sm text-muted">
            Let Brew Lab use your order history to learn your favourites and send you offers on drinks and add-ons you might
            like. Your name is never sold or shared. You can turn this off any time.
          </p>
          <ConsentToggle initial={me.analyticsConsent} />
          {me.analyticsConsentAt && me.analyticsConsent && (
            <p className="mt-2 text-xs text-muted">Turned on {formatDate(me.analyticsConsentAt)}.</p>
          )}
        </section>
      )}

      <p className="mt-8 text-sm text-muted">
        Member since {formatDate(me.createdAt)}. Want a copy of your data or to delete your account? See our{" "}
        <Link href="/privacy" className="text-accent underline">
          Privacy Notice
        </Link>
        .
      </p>
    </div>
  );
}

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { eq } from "drizzle-orm";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { emailOTP, twoFactor } from "better-auth/plugins";
import { after } from "next/server";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { logActivity } from "./audit";
import { sendAuthCode } from "./mail";

// branch_applicant: signed up as a branch owner, waiting for the super admin.
// support_agent: answers the support inbox and sees nothing else in the admin area.
// needs_two_factor: a super_admin or support_agent who hasn't turned on two-factor
// sign-in yet. Never stored; getSession reports it so every staff check fails closed.
export type Role = "customer" | "branch_applicant" | "branch_manager" | "super_admin" | "support_agent" | "needs_two_factor";
export const staffRoles: string[] = ["super_admin", "support_agent"];
export type AccountType = "customer" | "branch";

const superAdminEmails = (process.env.SUPER_ADMIN_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg", schema }),
  emailAndPassword: {
    enabled: true,
    // New accounts must confirm their email with a code before signing in.
    requireEmailVerification: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    revokeSessionsOnPasswordReset: true,
    onPasswordReset: async ({ user }) => {
      await logActivity({ userId: user.id, userEmail: user.email, action: "auth.password_reset" });
    },
  },
  emailVerification: {
    autoSignInAfterVerification: true,
  },
  // Email codes are only for verifying new accounts and resetting passwords, not for signing in.
  disabledPaths: ["/sign-in/email-otp"],
  user: {
    additionalFields: {
      // input: false stops users from setting their own role.
      role: { type: "string", required: false, defaultValue: "customer", input: false },
      accountType: { type: "string", required: false, defaultValue: "customer", input: true },
      termsAcceptedAt: { type: "date", required: false, input: false },
      // Optional opt-in at sign-up; can be changed later on the profile page.
      analyticsConsent: { type: "boolean", required: false, defaultValue: false, input: true },
      analyticsConsentAt: { type: "date", required: false, input: false },
    },
  },
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== "/sign-up/email") return;
      if (ctx.body?.acceptedTerms !== true) {
        throw new APIError("BAD_REQUEST", { message: "Please accept the Terms of Use and Privacy Notice." });
      }
      if (ctx.body?.accountType !== "customer" && ctx.body?.accountType !== "branch") {
        throw new APIError("BAD_REQUEST", { message: "Choose a customer or branch account." });
      }
    }),
    after: createAuthMiddleware(async (ctx) => {
      const session = ctx.context.session;
      if (!session || ctx.context.returned instanceof APIError) return;
      // Verifying an app code while signed in without 2FA is the last step of turning it on.
      const action =
        ctx.path === "/two-factor/verify-totp" && !session.user.twoFactorEnabled
          ? "auth.two_factor_enabled"
          : ctx.path === "/two-factor/disable"
            ? "auth.two_factor_disabled"
            : ctx.path === "/two-factor/generate-backup-codes"
              ? "auth.backup_codes_regenerated"
              : null;
      if (action) await logActivity({ userId: session.user.id, userEmail: session.user.email, action });
    }),
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          const accountType = (user as { accountType?: string }).accountType === "branch" ? "branch" : "customer";
          const role: Role = superAdminEmails.includes(user.email.toLowerCase())
            ? "super_admin"
            : accountType === "branch"
              ? "branch_applicant"
              : "customer";
          const analyticsConsent = (user as { analyticsConsent?: unknown }).analyticsConsent === true;
          return {
            data: {
              ...user,
              accountType,
              role,
              termsAcceptedAt: new Date(),
              analyticsConsent,
              analyticsConsentAt: analyticsConsent ? new Date() : null,
            },
          };
        },
        after: async (user) => {
          await logActivity({
            userId: user.id,
            userEmail: user.email,
            action: "auth.sign_up",
            details: { accountType: (user as { accountType?: string }).accountType },
          });
        },
      },
    },
    session: {
      create: {
        after: async (session) => {
          const [account] = await db
            .select({ email: schema.user.email })
            .from(schema.user)
            .where(eq(schema.user.id, session.userId));
          await logActivity({
            userId: session.userId,
            userEmail: account?.email,
            action: "auth.sign_in",
            ipAddress: session.ipAddress ?? null,
            userAgent: session.userAgent ?? null,
          });
        },
      },
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
  },
  rateLimit: {
    enabled: true,
    storage: "database",
  },
  plugins: [
    emailOTP({
      otpLength: 6,
      expiresIn: 600,
      allowedAttempts: 3,
      storeOTP: "hashed",
      sendVerificationOnSignUp: true,
      overrideDefaultEmailVerification: true,
      async sendVerificationOTP({ email, otp, type }) {
        if (type !== "email-verification" && type !== "forget-password") return;
        // Sent after the response so response timing doesn't reveal whether the email exists.
        after(() => sendAuthCode(email, otp, type));
      },
    }),
    twoFactor({
      issuer: "Brew Lab",
      backupCodeOptions: { amount: 10, storeBackupCodes: "encrypted" },
      // "Trust this device" skips the code on that browser for 30 days.
      trustDeviceMaxAge: 60 * 60 * 24 * 30,
      accountLockout: { enabled: true, maxFailedAttempts: 5, durationSeconds: 15 * 60 },
    }),
    nextCookies(),
  ],
});

export type Session = typeof auth.$Infer.Session;

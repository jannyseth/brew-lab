import type { Metadata } from "next";
import { ForgotPasswordForm } from "./forgot-password-form";

export const metadata: Metadata = { title: "Reset password" };

export default function ForgotPasswordPage() {
  return (
    <div className="mx-auto max-w-sm px-4 py-16">
      <h1 className="font-display text-3xl font-semibold tracking-tight">Reset your password</h1>
      <p className="mt-2 text-muted">We&apos;ll email you a code to choose a new password.</p>
      <ForgotPasswordForm />
    </div>
  );
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { authButton, authInput, CodeInput, FormError, PasswordInput } from "@/components/auth-ui";
import { TwoFactorStep } from "@/components/two-factor-step";
import { authClient } from "@/lib/auth-client";

export function ForgotPasswordForm() {
  const router = useRouter();
  const [step, setStep] = useState<"email" | "reset" | "two-factor">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function requestCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const { error } = await authClient.emailOtp.requestPasswordReset({ email });
    setBusy(false);
    if (error?.status === 429) return setError("Too many requests. Wait a minute and try again.");
    // Same response whether or not the email has an account, so accounts can't be discovered.
    setStep("reset");
  }

  async function reset(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== confirm) return setError("The passwords don't match.");
    setBusy(true);
    const { error } = await authClient.emailOtp.resetPassword({ email, otp: code, password });
    if (error) {
      setBusy(false);
      return setError(error.message ?? "That code didn't work.");
    }
    const signIn = await authClient.signIn.email({ email, password });
    if (signIn.error) return router.replace("/sign-in");
    // A new password doesn't skip two-factor sign-in.
    if ("twoFactorRedirect" in signIn.data) return setStep("two-factor");
    finish();
  }

  function finish() {
    router.replace("/account");
    router.refresh();
  }

  if (step === "two-factor") return <TwoFactorStep onDone={finish} />;

  if (step === "reset") {
    return (
      <form onSubmit={reset} className="mt-8">
        <p className="text-sm text-muted">
          If <span className="font-medium text-foreground">{email}</span> has an account, a code is on its way. It expires
          in 10 minutes.
        </p>
        <CodeInput value={code} onChange={setCode} />
        <PasswordInput label="New password" value={password} onChange={setPassword} autoComplete="new-password" />
        <PasswordInput label="Confirm new password" value={confirm} onChange={setConfirm} autoComplete="new-password" />
        <FormError message={error} />
        <button disabled={busy || code.length !== 6} className={authButton}>
          {busy ? "Saving…" : "Set new password"}
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={requestCode} className="mt-8">
      <label className="block text-sm font-medium">
        Email
        <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={authInput} />
      </label>
      <FormError message={error} />
      <button disabled={busy} className={authButton}>
        {busy ? "Sending…" : "Email me a code"}
      </button>
      <p className="mt-6 text-center text-sm text-muted">
        <Link href="/sign-in" className="hover:text-accent">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { authButton, authInput, CodeInput, FormError, PasswordInput } from "@/components/auth-ui";
import { TwoFactorStep } from "@/components/two-factor-step";
import { authClient, safeNext } from "@/lib/auth-client";

export function SignInForm() {
  const router = useRouter();
  const [step, setStep] = useState<"password" | "verify" | "two-factor">("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const finish = () => {
    router.replace(safeNext());
    router.refresh();
  };

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const { data, error } = await authClient.signIn.email({ email, password });
    if (!error) return afterPassword(data);
    setBusy(false);
    if (error.code === "EMAIL_NOT_VERIFIED") {
      // The account exists but its email was never confirmed: send a fresh code.
      await authClient.emailOtp.sendVerificationOtp({ email, type: "email-verification" });
      setStep("verify");
    } else {
      setError(
        error.status === 429
          ? "Too many attempts. Wait a minute and try again."
          : "Wrong email or password. Accounts made before passwords were introduced need to set one first: use “Forgot password?” below.",
      );
    }
  }

  // Accounts with two-factor sign-in still need an app code after the password.
  function afterPassword(data: unknown) {
    if (data && typeof data === "object" && "twoFactorRedirect" in data) {
      setBusy(false);
      return setStep("two-factor");
    }
    finish();
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const { error } = await authClient.emailOtp.verifyEmail({ email, otp: code });
    if (error) {
      setBusy(false);
      return setError(error.message ?? "That code didn't work.");
    }
    // Verified: now sign in with the password they already typed.
    const result = await authClient.signIn.email({ email, password });
    if (result.error) {
      setBusy(false);
      return setError("Email confirmed. Please sign in again.");
    }
    afterPassword(result.data);
  }

  if (step === "two-factor") return <TwoFactorStep onDone={finish} />;

  if (step === "verify") {
    return (
      <form onSubmit={verify} className="mt-8">
        <p className="text-sm text-muted">
          Please confirm your email first. We sent a code to <span className="font-medium text-foreground">{email}</span>.
        </p>
        <CodeInput value={code} onChange={setCode} />
        <FormError message={error} />
        <button disabled={busy || code.length !== 6} className={authButton}>
          {busy ? "Checking…" : "Confirm and sign in"}
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={signIn} className="mt-8">
      <label className="block text-sm font-medium">
        Email
        <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={authInput} />
      </label>
      <PasswordInput value={password} onChange={setPassword} autoComplete="current-password" />
      <div className="mt-2 text-right text-sm">
        <Link href="/forgot-password" className="text-muted hover:text-accent">
          Forgot password?
        </Link>
      </div>
      <FormError message={error} />
      <button disabled={busy} className={authButton}>
        {busy ? "Signing in…" : "Sign in"}
      </button>
      <p className="mt-6 text-center text-sm text-muted">
        New here?{" "}
        <Link href="/sign-up" className="font-medium text-accent">
          Create an account
        </Link>
      </p>
    </form>
  );
}

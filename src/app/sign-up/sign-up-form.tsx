"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { authButton, authInput, CodeInput, FormError, PasswordInput } from "@/components/auth-ui";
import { authClient } from "@/lib/auth-client";

const accountTypes = [
  { value: "customer", title: "Customer", body: "Order drinks, save your custom recipes and track orders." },
  { value: "branch", title: "Branch owner", body: "Run one or more branches. Verified by our admin before you can start." },
] as const;

export function SignUpForm() {
  const router = useRouter();
  const [step, setStep] = useState<"details" | "verify">("details");
  const [accountType, setAccountType] = useState<"customer" | "branch">("customer");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function signUp(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== confirm) return setError("The passwords don't match.");
    setBusy(true);
    const { error } = await authClient.signUp.email({
      name,
      email,
      password,
      accountType,
      // Checked again on the server: sign-up is refused without consent.
      ...({ acceptedTerms: accepted } as object),
    });
    setBusy(false);
    if (error) {
      return setError(
        error.code === "USER_ALREADY_EXISTS" || error.code === "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL"
          ? "An account with this email already exists. Try signing in or resetting your password."
          : (error.message ?? "Couldn't create the account."),
      );
    }
    setStep("verify");
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
    router.replace("/account");
    router.refresh();
  }

  async function resend() {
    setError("");
    const { error } = await authClient.emailOtp.sendVerificationOtp({ email, type: "email-verification" });
    setError(error ? "Couldn't resend yet. Wait a minute and try again." : "");
  }

  if (step === "verify") {
    return (
      <form onSubmit={verify} className="mt-8">
        <p className="text-sm text-muted">
          We sent a code to <span className="font-medium text-foreground">{email}</span>. Enter it to confirm your email. It
          expires in 10 minutes.
        </p>
        <CodeInput value={code} onChange={setCode} />
        <FormError message={error} />
        <button disabled={busy || code.length !== 6} className={authButton}>
          {busy ? "Checking…" : "Confirm email"}
        </button>
        <button type="button" onClick={resend} className="mt-3 w-full text-sm text-muted hover:text-accent">
          Resend the code
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={signUp} className="mt-8">
      <fieldset>
        <legend className="text-sm font-medium">Account type</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {accountTypes.map((t) => (
            <label
              key={t.value}
              className={`cursor-pointer rounded-2xl border p-4 has-focus-visible:ring-2 has-focus-visible:ring-accent ${
                accountType === t.value ? "border-accent bg-accent-soft" : "border-line bg-card hover:border-accent"
              }`}
            >
              <input
                type="radio"
                name="accountType"
                className="sr-only"
                checked={accountType === t.value}
                onChange={() => setAccountType(t.value)}
              />
              <span className="font-medium">{t.title}</span>
              <span className="mt-1 block text-xs text-muted">{t.body}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <label className="mt-4 block text-sm font-medium">
        {accountType === "branch" ? "Owner's full name" : "Your name"}
        <input required maxLength={80} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} className={authInput} />
      </label>
      <label className="mt-4 block text-sm font-medium">
        Email
        <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={authInput} />
      </label>
      <PasswordInput value={password} onChange={setPassword} autoComplete="new-password" />
      <PasswordInput label="Confirm password" value={confirm} onChange={setConfirm} autoComplete="new-password" />

      <label className="mt-6 flex gap-3 text-sm">
        <input
          type="checkbox"
          required
          checked={accepted}
          onChange={(e) => setAccepted(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 accent-accent"
        />
        <span>
          I have read and agree to the{" "}
          <Link href="/terms" target="_blank" className="font-medium text-accent underline">
            Terms of Use
          </Link>{" "}
          and{" "}
          <Link href="/privacy" target="_blank" className="font-medium text-accent underline">
            Privacy Notice
          </Link>
          , and I consent to Brew Lab processing my personal data for the purposes described there.
        </span>
      </label>

      <FormError message={error} />
      <button disabled={busy || !accepted} className={authButton}>
        {busy ? "Creating account…" : "Create account"}
      </button>
      <p className="mt-6 text-center text-sm text-muted">
        Already have an account?{" "}
        <Link href="/sign-in" className="font-medium text-accent">
          Sign in
        </Link>
      </p>
    </form>
  );
}

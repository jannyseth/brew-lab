"use client";

import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { useState } from "react";
import { CodeInput, FormError, PasswordInput } from "@/components/auth-ui";
import { buttonPrimary, buttonSecondary } from "@/components/ui";
import { authClient } from "@/lib/auth-client";

type Step =
  | { name: "idle" }
  | { name: "password"; purpose: "enable" | "codes" | "disable" }
  | { name: "scan"; qr: string; secret: string; backupCodes: string[] }
  | { name: "codes"; backupCodes: string[] };

export function TwoFactorSetup({ enabled, staff }: { enabled: boolean; staff: boolean }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>({ name: "idle" });
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function go(next: Step) {
    setStep(next);
    setPassword("");
    setCode("");
    setError("");
    setBusy(false);
  }

  function fail(message: string) {
    setBusy(false);
    setError(message);
  }

  const wrongPassword = (status: number) =>
    status === 429 ? "Too many attempts. Wait a minute and try again." : "That password isn't right.";

  async function confirmPassword(e: React.FormEvent, purpose: "enable" | "codes" | "disable") {
    e.preventDefault();
    setBusy(true);
    setError("");
    if (purpose === "enable") {
      const { data, error } = await authClient.twoFactor.enable({ password, method: "totp" });
      if (error) return fail(wrongPassword(error.status));
      if (data.method !== "totp") return fail("Something went wrong. Please try again.");
      const secret = new URL(data.totpURI).searchParams.get("secret") ?? "";
      const qr = await QRCode.toDataURL(data.totpURI, { margin: 1, width: 220 });
      return go({ name: "scan", qr, secret, backupCodes: data.backupCodes });
    }
    if (purpose === "codes") {
      const { data, error } = await authClient.twoFactor.generateBackupCodes({ password });
      if (error) return fail(wrongPassword(error.status));
      return go({ name: "codes", backupCodes: data.backupCodes });
    }
    const { error } = await authClient.twoFactor.disable({ password });
    if (error) return fail(wrongPassword(error.status));
    go({ name: "idle" });
    router.refresh();
  }

  async function confirmCode(e: React.FormEvent, backupCodes: string[]) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const { error } = await authClient.twoFactor.verifyTotp({ code });
    if (error?.code === "INVALID_CODE") {
      return fail("That code didn't work. Check your phone's time is set automatically, then try the code showing now.");
    }
    if (error) return fail("Something went wrong. Start again with “Set up two-factor sign-in”.");
    go({ name: "codes", backupCodes });
  }

  function finish() {
    go({ name: "idle" });
    // Staff go straight on to the admin area, which is now unlocked.
    router.replace(staff ? "/account" : "/account/two-factor");
    router.refresh();
  }

  if (step.name === "password") {
    const labels = { enable: "Continue", codes: "Show new backup codes", disable: "Turn off two-factor sign-in" };
    return (
      <form onSubmit={(e) => confirmPassword(e, step.purpose)}>
        <h2 className="font-semibold">Confirm it&apos;s you</h2>
        {step.purpose === "codes" && (
          <p className="mt-1 text-sm text-muted">Your old backup codes will stop working.</p>
        )}
        {step.purpose === "disable" && staff && (
          <p className="mt-1 text-sm text-red-600">Turning this off locks the admin area until you turn it back on.</p>
        )}
        <PasswordInput value={password} onChange={setPassword} autoComplete="current-password" />
        <FormError message={error} />
        <div className="mt-6 flex flex-wrap gap-3">
          <button disabled={busy} className={buttonPrimary}>
            {busy ? "Checking…" : labels[step.purpose]}
          </button>
          <button type="button" onClick={() => go({ name: "idle" })} className={buttonSecondary}>
            Cancel
          </button>
        </div>
      </form>
    );
  }

  if (step.name === "scan") {
    return (
      <form onSubmit={(e) => confirmCode(e, step.backupCodes)}>
        <h2 className="font-semibold">1. Scan this with your authenticator app</h2>
        <p className="mt-1 text-sm text-muted">
          Use Google Authenticator, Microsoft Authenticator, 1Password or any app that shows 6-digit codes. Tap “+” or “Add
          account”, then scan.
        </p>
        {/* eslint-disable-next-line @next/next/no-img-element -- a generated data: URL, nothing to optimize */}
        <img src={step.qr} alt="QR code for your authenticator app" width={220} height={220} className="mx-auto mt-4 rounded-xl bg-white p-2" />
        <details className="mt-3 text-sm text-muted">
          <summary className="cursor-pointer">Can&apos;t scan? Type this key instead</summary>
          <code className="mt-2 block break-all rounded-lg bg-stone-100 p-3 font-mono text-foreground dark:bg-stone-800">
            {step.secret}
          </code>
        </details>
        <h2 className="mt-6 font-semibold">2. Enter the code the app shows</h2>
        <CodeInput value={code} onChange={setCode} />
        <FormError message={error} />
        <button disabled={busy || code.length !== 6} className={`${buttonPrimary} mt-6`}>
          {busy ? "Checking…" : "Turn on two-factor sign-in"}
        </button>
      </form>
    );
  }

  if (step.name === "codes") {
    const text = step.backupCodes.join("\n");
    return (
      <div>
        <h2 className="font-semibold">Save your backup codes</h2>
        <p className="mt-1 text-sm text-muted">
          If you lose your phone, each of these codes lets you sign in once. Keep them somewhere safe, like a password
          manager or printed out. This is the only time they&apos;re shown.
        </p>
        <ul className="mt-4 grid grid-cols-2 gap-2 rounded-xl bg-stone-100 p-4 font-mono text-sm dark:bg-stone-800">
          {step.backupCodes.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
        <div className="mt-4 flex flex-wrap gap-3">
          <button type="button" onClick={() => navigator.clipboard.writeText(text)} className={buttonSecondary}>
            Copy
          </button>
          <a
            href={`data:text/plain;charset=utf-8,${encodeURIComponent(`Brew Lab backup codes\n\n${text}\n`)}`}
            download="brew-lab-backup-codes.txt"
            className={buttonSecondary}
          >
            Download
          </a>
        </div>
        <button type="button" onClick={finish} className={`${buttonPrimary} mt-6`}>
          I&apos;ve saved them
        </button>
      </div>
    );
  }

  if (!enabled) {
    return (
      <div>
        <h2 className="font-semibold">Two-factor sign-in is off</h2>
        <p className="mt-1 text-sm text-muted">
          You&apos;ll need your password and a phone with an authenticator app. It takes about two minutes.
        </p>
        <button type="button" onClick={() => go({ name: "password", purpose: "enable" })} className={`${buttonPrimary} mt-4`}>
          Set up two-factor sign-in
        </button>
      </div>
    );
  }

  return (
    <div>
      <h2 className="font-semibold">Two-factor sign-in is on</h2>
      <p className="mt-1 text-sm text-muted">
        When you sign in, Brew Lab asks for a code from your authenticator app. If you lose your phone, use a backup code.
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <button type="button" onClick={() => go({ name: "password", purpose: "codes" })} className={buttonSecondary}>
          New backup codes
        </button>
        <button type="button" onClick={() => go({ name: "password", purpose: "disable" })} className={buttonSecondary}>
          Turn off
        </button>
      </div>
    </div>
  );
}

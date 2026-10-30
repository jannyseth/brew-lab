"use client";

import { useState } from "react";
import { authButton, authInput, CodeInput, FormError } from "@/components/auth-ui";
import { authClient } from "@/lib/auth-client";

// Second sign-in step for accounts with two-factor sign-in turned on.
export function TwoFactorStep({ onDone }: { onDone: () => void }) {
  const [useBackup, setUseBackup] = useState(false);
  const [code, setCode] = useState("");
  const [trustDevice, setTrustDevice] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const { error } = useBackup
      ? await authClient.twoFactor.verifyBackupCode({ code: code.trim(), trustDevice })
      : await authClient.twoFactor.verifyTotp({ code, trustDevice });
    if (!error) return onDone();
    setBusy(false);
    setError(
      error.status === 429 || error.code === "ACCOUNT_TEMPORARILY_LOCKED"
        ? "Too many wrong codes. Wait 15 minutes and try again."
        : error.code === "INVALID_TWO_FACTOR_COOKIE"
          ? "This sign-in expired. Go back to Sign in and enter your password again."
          : useBackup && error.code === "INVALID_BACKUP_CODE"
            ? "That backup code didn't work, or it was already used."
            : error.code === "INVALID_CODE"
              ? "That code didn't work. Codes change every 30 seconds, so use the one showing now."
              : "Something went wrong checking your code. Please contact Brew Lab support.",
    );
  }

  function switchMethod() {
    setUseBackup(!useBackup);
    setCode("");
    setError("");
  }

  return (
    <form onSubmit={verify} className="mt-8">
      <p className="text-sm text-muted">
        {useBackup
          ? "Enter one of the backup codes you saved when you turned on two-factor sign-in. Each code works once."
          : "Open your authenticator app and enter the 6-digit code for Brew Lab."}
      </p>
      {useBackup ? (
        <label className="mt-4 block text-sm font-medium">
          Backup code
          <input
            required
            autoFocus
            autoComplete="off"
            maxLength={32}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className={`${authInput} text-center font-mono tracking-wider`}
          />
        </label>
      ) : (
        <CodeInput value={code} onChange={setCode} />
      )}
      <label className="mt-4 flex items-center gap-2 text-sm">
        <input type="checkbox" checked={trustDevice} onChange={(e) => setTrustDevice(e.target.checked)} />
        Don&apos;t ask again on this device for 30 days
      </label>
      <FormError message={error} />
      <button disabled={busy || (!useBackup && code.length !== 6)} className={authButton}>
        {busy ? "Checking…" : "Verify and sign in"}
      </button>
      <button type="button" onClick={switchMethod} className="mt-4 w-full text-center text-sm text-muted hover:text-accent">
        {useBackup ? "Use my authenticator app instead" : "Lost your phone? Use a backup code"}
      </button>
    </form>
  );
}

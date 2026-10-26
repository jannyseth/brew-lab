"use client";

// Shared pieces for the sign-in, sign-up and password reset forms.

export const authInput =
  "mt-1 w-full rounded-xl border border-line bg-card px-4 py-3 outline-none focus:border-accent focus:ring-2 focus:ring-accent/30";
export const authButton =
  "mt-6 w-full rounded-full bg-accent px-5 py-3 font-medium text-accent-contrast hover:opacity-90 disabled:opacity-50";

export function CodeInput({ value, onChange }: { value: string; onChange: (code: string) => void }) {
  return (
    <label className="mt-4 block text-sm font-medium">
      6-digit code
      <input
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]{6}"
        maxLength={6}
        required
        autoFocus
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))}
        className={`${authInput} text-center text-2xl tracking-[0.5em]`}
      />
    </label>
  );
}

export function PasswordInput({
  label = "Password",
  value,
  onChange,
  autoComplete,
}: {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: "current-password" | "new-password";
}) {
  return (
    <label className="mt-4 block text-sm font-medium">
      {label}
      <input
        type="password"
        required
        minLength={autoComplete === "new-password" ? 8 : undefined}
        maxLength={128}
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={authInput}
      />
      {autoComplete === "new-password" && <span className="mt-1 block text-xs font-normal text-muted">At least 8 characters.</span>}
    </label>
  );
}

export function FormError({ message }: { message: string }) {
  return message ? (
    <p role="alert" className="mt-3 text-sm text-red-600">
      {message}
    </p>
  ) : null;
}

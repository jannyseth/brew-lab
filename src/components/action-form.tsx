"use client";

import { useActionState, useEffect, useRef } from "react";
import { buttonPrimary } from "./ui";

export type FormState = { ok: boolean; message: string } | null;

/** A form bound to a server action that shows its result and clears itself on success. */
export function ActionForm({
  action,
  submitLabel,
  className,
  children,
}: {
  action: (state: FormState, data: FormData) => Promise<FormState>;
  submitLabel: string;
  className?: string;
  children: React.ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) ref.current?.reset();
  }, [state]);

  return (
    <form ref={ref} action={formAction} className={className}>
      {children}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button disabled={pending} className={buttonPrimary}>
          {pending ? "Saving…" : submitLabel}
        </button>
        {state && (
          <p role="status" className={`text-sm ${state.ok ? "text-emerald-700 dark:text-emerald-400" : "text-red-600"}`}>
            {state.message}
          </p>
        )}
      </div>
    </form>
  );
}

"use client";

import { useState, useTransition } from "react";
import { clockPunch } from "@/app/actions/lounge";

/** The big clock in / clock out button after scanning the counter code. */
export function PunchButton({ branchId, code, clockedIn }: { branchId: number; code: string; clockedIn: boolean }) {
  const [state, setState] = useState<{ ok: boolean; message: string; clockedIn?: boolean } | null>(null);
  const [pending, startTransition] = useTransition();
  const done = state?.ok;
  const now = done ? state.clockedIn : clockedIn;

  return (
    <div className="text-center">
      {!done && (
        <button
          type="button"
          disabled={pending}
          onClick={() => startTransition(async () => setState(await clockPunch(branchId, code)))}
          className={`h-40 w-40 rounded-full text-xl font-bold text-white shadow-xl transition active:scale-95 disabled:opacity-60 ${
            clockedIn ? "bg-rose-600" : "bg-emerald-600"
          }`}
        >
          {pending ? "…" : clockedIn ? "Clock out" : "Clock in"}
        </button>
      )}
      {state && (
        <p role="status" className={`mt-6 text-lg font-semibold ${state.ok ? "" : "text-red-600"}`}>
          {state.ok ? (now ? "✅ " : "👋 ") : ""}
          {state.message}
        </p>
      )}
    </div>
  );
}

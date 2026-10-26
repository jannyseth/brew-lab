"use client";

import { useState, useTransition } from "react";
import { setAnalyticsConsent } from "@/app/actions/profile";

export function ConsentToggle({ initial }: { initial: boolean }) {
  const [on, setOn] = useState(initial);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  return (
    <div className="mt-4">
      <label className="flex cursor-pointer items-center gap-3 text-sm font-medium">
        <input
          type="checkbox"
          role="switch"
          checked={on}
          disabled={pending}
          onChange={(e) => {
            const next = e.target.checked;
            setOn(next);
            startTransition(async () => {
              const result = await setAnalyticsConsent(next);
              if (result && !result.ok) setOn(!next);
              setMessage(result?.message ?? "");
            });
          }}
          className="h-5 w-5 accent-accent"
        />
        Use my order history for personalized offers
      </label>
      {message && (
        <p role="status" className="mt-2 text-xs text-muted">
          {message}
        </p>
      )}
    </div>
  );
}

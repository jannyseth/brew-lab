"use client";

import { useState, useTransition } from "react";
import { updateCreatorProfile } from "@/app/actions/customer";
import { buttonSecondary } from "@/components/ui";

export function CreatorSettings(props: { handle: string; showOnLeaderboard: boolean }) {
  const [handle, setHandle] = useState(props.handle);
  const [showOnLeaderboard, setShowOnLeaderboard] = useState(props.showOnLeaderboard);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="rounded-2xl border border-line p-4"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const result = await updateCreatorProfile({ handle, showOnLeaderboard });
          setMessage(result.ok ? { ok: true, text: "Saved." } : { ok: false, text: result.error });
        });
      }}
    >
      <p className="font-medium">Creator settings</p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <span className="flex items-center rounded-xl border border-line bg-card px-3 focus-within:border-accent">
          <span className="text-muted">@</span>
          <input
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            pattern="[a-zA-Z0-9._]{3,20}"
            required
            aria-label="Creator name"
            className="w-40 bg-transparent px-1 py-2 outline-none"
          />
        </span>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={showOnLeaderboard}
            onChange={(e) => setShowOnLeaderboard(e.target.checked)}
            className="h-4 w-4 accent-[var(--accent)]"
          />
          Show on the leaderboard
        </label>
        <button disabled={pending} className={buttonSecondary}>
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
      {message && <p className={`mt-2 text-sm ${message.ok ? "text-muted" : "text-red-600"}`}>{message.text}</p>}
    </form>
  );
}

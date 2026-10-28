"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { publishSignatureDrink } from "@/app/actions/customer";
import { buttonPrimary, inputClass } from "@/components/ui";

type Props = {
  savedDrinkId: number;
  defaultName: string;
  profile: { handle: string; showOnLeaderboard: boolean } | null;
};

export function PublishForm({ savedDrinkId, defaultName, profile }: Props) {
  const router = useRouter();
  const [name, setName] = useState(defaultName.slice(0, 40));
  const [story, setStory] = useState("");
  const [handle, setHandle] = useState(profile?.handle ?? "");
  const [showOnLeaderboard, setShowOnLeaderboard] = useState(profile?.showOnLeaderboard ?? true);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        setError("");
        startTransition(async () => {
          const result = await publishSignatureDrink({ savedDrinkId, name, story, handle: handle || undefined, showOnLeaderboard });
          if (result.ok) router.push("/rewards?submitted=1");
          else setError(result.error);
        });
      }}
    >
      <label className="block text-sm font-medium">
        Drink name
        <input value={name} onChange={(e) => setName(e.target.value)} minLength={2} maxLength={40} required className={inputClass} />
      </label>
      <label className="block text-sm font-medium">
        Why you love it <span className="font-normal text-muted">(optional, shown on the drink page)</span>
        <textarea value={story} onChange={(e) => setStory(e.target.value)} maxLength={200} rows={2} className={inputClass} />
      </label>
      <label className="block text-sm font-medium">
        Creator name
        <span className="mt-1 flex items-center rounded-xl border border-line bg-card px-3 focus-within:border-accent">
          <span className="text-muted">@</span>
          <input
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            pattern="[a-zA-Z0-9._]{3,20}"
            required
            className="w-full bg-transparent px-1 py-2 outline-none"
          />
        </span>
        <span className="mt-1 block font-normal text-muted">Shown instead of your real name. 3-20 letters, numbers, dots or underscores.</span>
      </label>
      <label className="flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          checked={showOnLeaderboard}
          onChange={(e) => setShowOnLeaderboard(e.target.checked)}
          className="mt-1 h-4 w-4 accent-[var(--accent)]"
        />
        <span>
          <span className="font-medium">Show my drinks on the public leaderboard</span>
          <span className="block text-muted">Only your creator name is shown. You can turn this off any time in Rewards.</span>
        </span>
      </label>
      <p className="text-sm text-muted">The Brew Lab team checks each drink before it goes public, usually within a day.</p>
      <button disabled={pending} className={buttonPrimary}>
        {pending ? "Sending…" : "Send for review"}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  );
}

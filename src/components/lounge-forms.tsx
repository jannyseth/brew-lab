"use client";

import { useRouter } from "next/navigation";
import { useActionState, useState, useTransition } from "react";
import { createGroup, createInvite, openDirectChat, revokeInvite } from "@/app/actions/lounge";
import { buttonPrimary, inputClass } from "./ui";

// Buttons and forms for the employee lounge.

/** Makes a single-use hiring link and shows it ready to copy or share. */
export function InviteForm({ branchId }: { branchId: number }) {
  const [state, action, pending] = useActionState(createInvite.bind(null, branchId), null);
  return (
    <div>
      <form action={action} className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-[minmax(0,1fr)_140px_auto] sm:items-end">
        <label className="block text-sm font-medium">
          Position
          <input name="position" required minLength={2} maxLength={60} placeholder="Barista" className={inputClass} />
        </label>
        <label className="block text-sm font-medium">
          Rate per hour (₱)
          <input name="hourlyRate" type="number" step="0.01" min="0" required className={inputClass} />
        </label>
        <button disabled={pending} className={buttonPrimary}>
          {pending ? "Making…" : "Make invite link"}
        </button>
      </form>
      {state && !state.ok && <p className="mt-2 text-sm text-red-600">{state.message}</p>}
      {state?.ok && state.link && <InviteLink path={state.link} fresh />}
    </div>
  );
}

/** One open invite link: copy, share or turn off. */
export function InviteLink({ path, fresh, branchId, token, label }: { path: string; fresh?: boolean; branchId?: number; token?: string; label?: string }) {
  const [message, setMessage] = useState(fresh ? "Copy it and send it by text or chat. It works once and expires in 7 days." : "");
  const [pending, startTransition] = useTransition();
  const url = () => new URL(path, window.location.origin).toString();
  return (
    <div className={`mt-3 rounded-xl px-4 py-3 text-sm ${fresh ? "bg-accent-soft" : "bg-background ring-1 ring-line"}`}>
      {label && <p className="font-medium">{label}</p>}
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <code className="min-w-0 flex-1 truncate text-xs">{path}</code>
        <button
          type="button"
          onClick={async () => {
            try {
              if (navigator.share) await navigator.share({ title: "Join our team on Brew Lab", url: url() });
              else {
                await navigator.clipboard.writeText(url());
                setMessage("Link copied.");
              }
            } catch {}
          }}
          className="rounded-full bg-accent px-3 py-1.5 text-xs font-semibold text-accent-contrast"
        >
          Share
        </button>
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(url());
              setMessage("Link copied.");
            } catch {}
          }}
          className="rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ring-line"
        >
          Copy
        </button>
        {branchId && token && (
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              confirm("Turn off this link? Nobody will be able to join with it.") &&
              startTransition(async () => void (await revokeInvite(branchId, token)))
            }
            className="text-xs text-muted hover:text-red-600"
          >
            Turn off
          </button>
        )}
      </div>
      {message && <p className="mt-1 text-xs text-muted">{message}</p>}
    </div>
  );
}

/** Opens the private chat with someone at the branch. */
export function MessageButton({ branchId, userId, label = "Message" }: { branchId: number; userId: string; label?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await openDirectChat(branchId, userId);
          if (result.path) router.push(result.path);
          else alert(result.message);
        })
      }
      className="rounded-full px-3 py-1.5 text-xs font-semibold text-accent ring-1 ring-line hover:ring-accent disabled:opacity-50"
    >
      {pending ? "…" : label}
    </button>
  );
}

/** Starts a group chat with chosen people from the branch. */
export function NewGroupForm({ branchId, people }: { branchId: number; people: { userId: string; name: string }[] }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(async (prev: Awaited<ReturnType<typeof createGroup>> | null, data: FormData) => {
    const result = await createGroup(branchId, prev, data);
    if (result.path) router.push(result.path);
    return result;
  }, null);
  if (people.length === 0) return <p className="text-sm text-muted">Hire someone first to start a group.</p>;
  return (
    <form action={action} className="space-y-3">
      <label className="block text-sm font-medium">
        Group name
        <input name="title" required minLength={2} maxLength={60} placeholder="Morning shift" className={inputClass} />
      </label>
      <fieldset>
        <legend className="text-sm font-medium">Who&apos;s in it</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {people.map((p) => (
            <label key={p.userId} className="flex cursor-pointer items-center gap-2 rounded-full px-3 py-1.5 text-sm ring-1 ring-line has-checked:bg-accent-soft has-checked:ring-accent">
              <input type="checkbox" name="members" value={p.userId} className="accent-[var(--accent)]" />
              {p.name}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="flex items-center gap-3">
        <button disabled={pending} className={buttonPrimary}>
          {pending ? "Starting…" : "Start group"}
        </button>
        {state && !state.ok && <p className="text-sm text-red-600">{state.message}</p>}
      </div>
    </form>
  );
}

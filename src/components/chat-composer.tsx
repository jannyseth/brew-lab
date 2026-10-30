"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { leaveGroup, markRead, sendMessage } from "@/app/actions/lounge";

/** The reply box under a chat. Also marks the chat read whenever a new message shows up. */
export function ChatComposer({ conversationId, latestId, canLeave }: { conversationId: number; latestId: number; canLeave: boolean }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    void markRead(conversationId);
  }, [conversationId, latestId]);

  function send() {
    const body = text.trim();
    if (!body) return;
    setError("");
    startTransition(async () => {
      const result = await sendMessage(conversationId, body);
      if (!result.ok) return setError(result.message);
      setText("");
      router.refresh();
    });
  }

  return (
    <div className="border-t border-line pt-3">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        className="flex items-end gap-2"
      >
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            // Enter sends; Shift+Enter makes a new line.
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          rows={1}
          maxLength={2000}
          placeholder="Write a message"
          aria-label="Message"
          className="max-h-32 min-h-11 flex-1 resize-none rounded-2xl border border-line bg-card px-4 py-2.5 text-sm outline-none focus:border-accent"
        />
        <button
          disabled={pending || !text.trim()}
          className="h-11 rounded-full bg-accent px-5 text-sm font-semibold text-accent-contrast hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "…" : "Send"}
        </button>
      </form>
      <div className="mt-1 flex justify-between text-xs">
        <span className="text-red-600">{error}</span>
        {canLeave && (
          <button
            type="button"
            onClick={() =>
              confirm("Leave this group? You won't see its messages anymore.") &&
              startTransition(async () => {
                const result = await leaveGroup(conversationId);
                if (result.path) router.push(result.path);
                else setError(result.message);
              })
            }
            className="text-muted hover:text-red-600"
          >
            Leave group
          </button>
        )}
      </div>
    </div>
  );
}

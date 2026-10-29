"use client";

import { useState, useTransition } from "react";
import { setSupportAgent } from "@/app/actions/admin";

/** Turns a customer account into a support agent, or back. */
export function SupportAgentButton({ userId, isAgent }: { userId: string; isAgent: boolean }) {
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const question = isAgent
    ? "Remove this person's access to the support inbox? Their open tickets go back to the shared queue."
    : "Let this person answer the support inbox? They will see customers' support messages, names and emails, but nothing else in the admin area.";
  return (
    <span className="inline-flex flex-col items-start">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          confirm(question) &&
          startTransition(async () => {
            const result = await setSupportAgent(userId, !isAgent);
            setError(result && !result.ok ? result.message : "");
          })
        }
        className={`text-xs font-medium ${isAgent ? "text-muted hover:text-red-600" : "text-accent hover:underline"}`}
      >
        {isAgent ? "Remove support access" : "Make support agent"}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </span>
  );
}

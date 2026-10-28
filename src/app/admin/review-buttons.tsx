"use client";

import { useState, useTransition } from "react";
import { reissueLicense, reviewBranch, reviewOwner, reviewSignatureDrink, revokeLicense, suspendBranch } from "@/app/actions/admin";
import type { FormState } from "@/components/action-form";
import { buttonPrimary, buttonSecondary, inputClass } from "@/components/ui";

const reviewers = { owner: reviewOwner, branch: reviewBranch, drink: reviewSignatureDrink };
const approveLabels = { owner: "Verify owner", branch: "Approve & license", drink: "Make public" };

export function ReviewButtons({ kind, id }: { kind: "owner" | "branch" | "drink"; id: number }) {
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const decide = (decision: "approved" | "rejected") =>
    startTransition(async () => {
      const result = await reviewers[kind](id, decision, note);
      if (result && !result.ok) setError(result.message);
    });

  return (
    <div className="mt-4">
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={300}
        placeholder={kind === "drink" ? "Note (shown to the creator if rejected)" : "Note (shown to the owner if rejected)"}
        aria-label="Review note"
        className={`${inputClass} text-sm`}
      />
      <div className="mt-3 flex gap-2">
        <button type="button" disabled={pending} className={buttonPrimary} onClick={() => decide("approved")}>
          {approveLabels[kind]}
        </button>
        <button type="button" disabled={pending} className={buttonSecondary} onClick={() => decide("rejected")}>
          Reject
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}

/** A small text button that confirms, runs an admin action and shows any error. */
function ConfirmAction({ label, question, run, danger }: { label: string; question: string; run: () => Promise<FormState>; danger?: boolean }) {
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  return (
    <span className="inline-flex flex-col items-end">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          confirm(question) &&
          startTransition(async () => {
            const result = await run();
            setError(result && !result.ok ? result.message : "");
          })
        }
        className={`text-xs font-medium ${danger ? "text-muted hover:text-red-600" : "text-accent hover:underline"}`}
      >
        {label}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </span>
  );
}

export function SuspendButton({ branchId }: { branchId: number }) {
  return (
    <ConfirmAction
      danger
      label="Suspend"
      question="Hide this branch from customers? It goes back to the approval queue and keeps its license."
      run={() => suspendBranch(branchId)}
    />
  );
}

export function ReissueButton({ branchId }: { branchId: number }) {
  return <ConfirmAction label="Issue new license" question="Issue a new 1-year license to this branch?" run={() => reissueLicense(branchId)} />;
}

export function RevokeButton({ licenseId }: { licenseId: number }) {
  return (
    <ConfirmAction
      danger
      label="Revoke license"
      question="Revoke this license? Customers won't be able to order from the branch until a new license is issued."
      run={() => revokeLicense(licenseId)}
    />
  );
}

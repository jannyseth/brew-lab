"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { acceptInvite } from "@/app/actions/lounge";
import { buttonPrimary } from "@/components/ui";

export function JoinButton({ token, branchName }: { token: string; branchName: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  return (
    <div>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await acceptInvite(token);
            if (!result.ok) return setError(result.message);
            router.replace("/work");
            router.refresh();
          })
        }
        className={`${buttonPrimary} w-full py-3`}
      >
        {pending ? "Joining…" : `Join ${branchName}`}
      </button>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}

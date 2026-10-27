"use client";

import { useState, useTransition } from "react";
import { resetMenuPhoto } from "@/app/actions/admin";

export function ResetPhotoButton({ slug }: { slug: string }) {
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  return (
    <p className="mt-3 text-right text-xs">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          confirm("Go back to the starter photo? Your upload will be deleted.") &&
          startTransition(async () => setMessage((await resetMenuPhoto(slug))?.message ?? ""))
        }
        className="text-muted hover:text-red-600"
      >
        {pending ? "Resetting…" : "Reset to starter photo"}
      </button>
      {message && <span className="ml-2 text-muted">{message}</span>}
    </p>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

/** Picks an image and uploads it right away: one click, no separate save button. */
export function ImageUpload({
  target,
  currentUrl,
  label,
  hint,
  shape = "round",
}: {
  target: { kind: "avatar" } | { kind: "branch"; id: number } | { kind: "menu"; slug: string };
  currentUrl: string | null;
  label: string;
  hint?: string;
  shape?: "round" | "wide" | "square";
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState(currentUrl);
  const [status, setStatus] = useState<{ error?: string; busy?: boolean; done?: boolean }>({});

  async function upload(file: File) {
    setStatus({ busy: true });
    const body = new FormData();
    body.set("file", file);
    body.set("target", target.kind);
    if (target.kind === "branch") body.set("id", String(target.id));
    if (target.kind === "menu") body.set("slug", target.slug);
    const res = await fetch("/api/images/upload", { method: "POST", body }).catch(() => null);
    const data = res ? await res.json().catch(() => ({})) : {};
    if (!res?.ok) return setStatus({ error: data.error ?? "Upload failed. Please try again." });
    setPreview(data.url);
    setStatus({ done: true });
    router.refresh();
  }

  return (
    <div className="flex items-center gap-4">
      <div
        className={`shrink-0 overflow-hidden bg-accent-soft ${
          shape === "round" ? "h-20 w-20 rounded-full" : shape === "square" ? "h-28 w-28 rounded-xl" : "aspect-[1200/630] w-40 rounded-xl"
        }`}
      >
        {preview && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt={label} className="h-full w-full object-cover" />
        )}
      </div>
      <div className="text-sm">
        <p className="font-medium">{label}</p>
        {hint && <p className="text-xs text-muted">{hint}</p>}
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          aria-label={`Upload ${label.toLowerCase()}`}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void upload(file);
            e.target.value = "";
          }}
        />
        <button
          type="button"
          disabled={status.busy}
          onClick={() => input.current?.click()}
          className="mt-2 rounded-full border border-line px-4 py-1.5 text-sm font-medium hover:border-accent disabled:opacity-50"
        >
          {status.busy ? "Uploading…" : preview ? "Change photo" : "Upload photo"}
        </button>
        {status.error && <p className="mt-1 text-xs text-red-600">{status.error}</p>}
        {status.done && <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-400">Saved.</p>}
      </div>
    </div>
  );
}

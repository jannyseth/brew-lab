"use client";

import { useState, useTransition } from "react";
import { shareReceipt } from "@/app/actions/customer";

/**
 * Share one receipt or one week as a picture card. Facebook and X open their
 * own post screens; Instagram has no web share link, so on phones the card
 * picture goes to the share sheet (pick Instagram there) or is saved first.
 */
export function ReceiptShare({ target, label = "Share" }: { target: { orderId: number } | { weekStart: string }; label?: string }) {
  const [path, setPath] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  const url = (p: string) => new URL(p, window.location.origin).toString();
  const text = "orderId" in target ? "My Brew Lab order ☕" : "My week at Brew Lab ☕";

  function open() {
    if (path) return setPath(null);
    startTransition(async () => {
      const result = await shareReceipt(target);
      if (result.ok) setPath(result.path);
      else setMessage(result.error);
    });
  }

  async function shareImage(p: string) {
    try {
      const blob = await (await fetch(`${p}/opengraph-image`)).blob();
      const file = new File([blob], "brew-lab.png", { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text });
        return;
      }
      const a = document.createElement("a");
      a.href = URL.createObjectURL(file);
      a.download = "brew-lab.png";
      a.click();
      setMessage("Picture saved. Post it from Instagram.");
    } catch {
      // The customer closed the share sheet.
    }
  }

  async function copy(p: string) {
    try {
      await navigator.clipboard.writeText(url(p));
      setMessage("Link copied");
    } catch {}
  }

  const chip = "rounded-full px-3 py-1.5 text-xs font-semibold";
  return (
    <div className="relative inline-block">
      <button type="button" onClick={open} disabled={pending} aria-expanded={!!path} className="text-sm font-medium text-accent hover:underline disabled:opacity-50">
        {pending ? "…" : label}
      </button>
      {path && (
        <div className="absolute right-0 z-20 mt-2 w-60 rounded-2xl border border-line bg-card p-3 shadow-xl">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url(path))}`, "_blank", "noopener,noreferrer,width=600,height=560")}
              className={`${chip} bg-[#1877f2] text-white`}
            >
              Facebook
            </button>
            <button
              type="button"
              onClick={() => window.open(`https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url(path))}`, "_blank", "noopener,noreferrer,width=600,height=560")}
              className={`${chip} bg-black text-white`}
            >
              X
            </button>
            <button type="button" onClick={() => shareImage(path)} className={`${chip} bg-gradient-to-r from-[#f58529] via-[#dd2a7b] to-[#8134af] text-white`}>
              Instagram
            </button>
            <button type="button" onClick={() => copy(path)} className={`${chip} ring-1 ring-line`}>
              Copy link
            </button>
          </div>
          <p className="mt-2 text-[11px] text-muted">{message || "Shows drinks and totals only, never your name."}</p>
        </div>
      )}
      {!path && message && <p className="text-xs text-red-600">{message}</p>}
    </div>
  );
}

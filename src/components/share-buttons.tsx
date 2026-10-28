"use client";

import { useState } from "react";

/**
 * Facebook doesn't let apps post for people. "Share on Facebook" opens
 * Facebook's own post screen, where the customer writes their post and taps
 * Post themselves. Sharing earns nothing; coins only come from orders.
 */
export function ShareButtons({ path, title }: { path: string; title: string }) {
  const [copied, setCopied] = useState(false);
  const url = () => new URL(path, window.location.origin).toString();

  const shareOnFacebook = () => {
    const href = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url())}`;
    window.open(href, "_blank", "noopener,noreferrer,width=600,height=560");
  };

  const shareOther = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title, url: url() });
      } catch {
        // The customer closed the share sheet.
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={shareOnFacebook}
          className="inline-flex items-center gap-2 rounded-full bg-[#1877f2] px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 fill-current">
            <path d="M14 8h3V4h-3c-2.8 0-4.5 1.9-4.5 4.6V11H7v4h2.5v9h4v-9H17l.5-4h-4V8.8c0-.5.3-.8.5-.8Z" />
          </svg>
          Share on Facebook
        </button>
        <button type="button" onClick={shareOther} className="rounded-full border border-line px-4 py-2 text-sm font-medium hover:border-accent">
          {copied ? "Link copied ✓" : "More ways to share"}
        </button>
      </div>
      <p className="mt-2 text-xs text-muted">Facebook asks you to confirm, and you choose what to post.</p>
    </div>
  );
}

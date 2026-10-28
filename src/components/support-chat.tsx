"use client";

import { useChat } from "@ai-sdk/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const suggestions = ["How do bean coins work?", "Where is my order?", "What are your branch hours?"];

/** Floating help button with the AI assistant. Hidden where it would cover the order bar, and for staff areas. */
export function SupportChat() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const { messages, sendMessage, status, error } = useChat();
  const listRef = useRef<HTMLDivElement>(null);
  const busy = status === "submitted" || status === "streaming";

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages, open]);

  const hidden = pathname.startsWith("/menu") || pathname.startsWith("/branch") || pathname.startsWith("/admin") || pathname.includes("/receipt");
  if (hidden) return null;

  const send = (text: string) => {
    const trimmed = text.trim().slice(0, 600);
    if (!trimmed || busy) return;
    sendMessage({ text: trimmed });
    setInput("");
  };

  return (
    <div className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] right-[calc(1rem+env(safe-area-inset-right))] z-40 print:hidden">
      {open && (
        <div
          role="dialog"
          aria-label="Brew Lab assistant"
          className="mb-3 flex h-[min(32rem,calc(100dvh-8rem))] w-[min(22rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-line bg-card shadow-xl"
        >
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <div>
              <p className="font-semibold">Brew Lab assistant</p>
              <p className="text-xs text-muted">
                AI answers ·{" "}
                <Link href="/faq" className="hover:text-accent">
                  FAQ
                </Link>
              </p>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close chat" className="text-xl text-muted hover:text-foreground">
              ×
            </button>
          </div>

          <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3 text-sm">
            {messages.length === 0 && (
              <div>
                <p className="text-muted">Hi! Ask me about the menu, your order, bean coins or our branches.</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {suggestions.map((s) => (
                    <button key={s} type="button" onClick={() => send(s)} className="rounded-full border border-line px-3 py-1 text-xs hover:border-accent">
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m) => {
              const text = m.parts.map((p) => (p.type === "text" ? p.text : "")).join("");
              const lookingUp = m.role === "assistant" && !text && m.parts.some((p) => p.type.startsWith("tool-"));
              if (!text && !lookingUp) return null;
              return (
                <p
                  key={m.id}
                  className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 ${
                    m.role === "user" ? "ml-auto bg-accent text-accent-contrast" : "bg-accent-soft"
                  }`}
                >
                  {text || "Looking that up…"}
                </p>
              );
            })}
            {status === "submitted" && <p className="w-fit rounded-2xl bg-accent-soft px-3 py-2 text-muted">…</p>}
            {error && <p className="text-red-600">Sorry, the assistant isn&apos;t available right now. Please try again or check the FAQ.</p>}
          </div>

          <form
            className="flex gap-2 border-t border-line p-3"
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              maxLength={600}
              placeholder="Type your question"
              aria-label="Your question"
              className="min-w-0 flex-1 rounded-full bg-background px-4 py-2 text-base outline-none ring-1 ring-line focus:ring-accent sm:text-sm"
            />
            <button disabled={busy || !input.trim()} className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-accent-contrast disabled:opacity-50">
              Send
            </button>
          </form>
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-label={open ? "Close help chat" : "Open help chat"}
        className="ml-auto flex h-14 w-14 items-center justify-center rounded-full bg-accent text-accent-contrast shadow-lg hover:opacity-90"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6 fill-none stroke-current" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          {open ? <path d="M6 6l12 12M18 6 6 18" /> : <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z" />}
        </svg>
      </button>
    </div>
  );
}

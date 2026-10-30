import Link from "next/link";
import { Avatar } from "./avatar";
import { AutoRefresh } from "./auto-refresh";
import { ChatComposer } from "./chat-composer";
import { formatDateTime } from "./ui";

// The employee lounge chat, shared by the branch owner's and the worker's screens.

type Message = { id: number; body: string; createdAt: Date; authorId: string | null; authorName: string | null; authorImage: string | null };

/** One conversation: messages oldest first, the viewer's own on the right, and a box to reply. */
export function ChatThread({
  conversationId,
  title,
  subtitle,
  backHref,
  messages,
  viewerId,
  canLeave,
}: {
  conversationId: number;
  title: string;
  subtitle?: string;
  backHref: string;
  messages: Message[];
  viewerId: string;
  canLeave: boolean;
}) {
  return (
    <div className="mx-auto flex h-[calc(100dvh-var(--header-h,5rem)-3rem)] min-h-[480px] max-w-2xl flex-col">
      {/* New messages arrive every few seconds while the chat is open. */}
      <AutoRefresh seconds={4} />
      <header className="flex items-center gap-3 border-b border-line pb-3">
        <Link href={backHref} aria-label="Back" className="flex h-9 w-9 items-center justify-center rounded-full text-lg hover:bg-accent-soft">
          ←
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-xl font-semibold">{title}</h1>
          {subtitle && <p className="truncate text-xs text-muted">{subtitle}</p>}
        </div>
      </header>
      <ol className="flex flex-1 flex-col gap-2 overflow-y-auto py-4" aria-live="polite">
        {messages.length === 0 && <li className="m-auto text-sm text-muted">No messages yet. Say hi 👋</li>}
        {messages.map((m, i) => {
          const mine = m.authorId === viewerId;
          const sameAsPrevious = messages[i - 1]?.authorId === m.authorId;
          return (
            <li key={m.id} className={`flex items-end gap-2 ${mine ? "flex-row-reverse" : ""}`}>
              {!mine && (
                <span className={sameAsPrevious ? "invisible" : ""}>
                  <Avatar src={m.authorImage} name={m.authorName ?? "?"} size={28} />
                </span>
              )}
              <div className={`max-w-[78%] rounded-2xl px-3.5 py-2 text-sm ${mine ? "bg-accent text-accent-contrast" : "bg-card ring-1 ring-line"}`}>
                {!mine && !sameAsPrevious && <p className="text-xs font-semibold">{m.authorName ?? "Former coworker"}</p>}
                <p className="whitespace-pre-wrap break-words">{m.body}</p>
                <p className={`mt-0.5 text-[10px] ${mine ? "opacity-75" : "text-muted"}`}>{formatDateTime(m.createdAt)}</p>
              </div>
            </li>
          );
        })}
      </ol>
      <ChatComposer conversationId={conversationId} latestId={messages.at(-1)?.id ?? 0} canLeave={canLeave} />
    </div>
  );
}

type ChatRow = { id: number; name: string; kind: string; branchName: string; preview: string | null; unread: number; lastMessageAt: Date };

/** A list of chats with unread badges. */
export function ChatList({ chats, hrefFor, showBranch }: { chats: ChatRow[]; hrefFor: (id: number) => string; showBranch?: boolean }) {
  if (chats.length === 0) return <p className="text-sm text-muted">No chats yet.</p>;
  return (
    <ul className="divide-y divide-line rounded-2xl border border-line bg-card">
      {chats.map((c) => (
        <li key={c.id}>
          <Link href={hrefFor(c.id)} className="flex items-center gap-3 px-4 py-3 hover:bg-accent-soft/50">
            <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-base">
              {c.kind === "branch" ? "🏠" : c.kind === "group" ? "👥" : "💬"}
            </span>
            <span className="min-w-0 flex-1">
              <span className={`block truncate text-sm ${c.unread ? "font-semibold" : "font-medium"}`}>{c.name}</span>
              <span className="block truncate text-xs text-muted">
                {showBranch && c.kind !== "branch" ? `${c.branchName} · ` : ""}
                {c.preview ?? "No messages yet"}
              </span>
            </span>
            {c.unread > 0 && (
              <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-semibold text-accent-contrast" aria-label={`${c.unread} unread`}>
                {c.unread}
              </span>
            )}
          </Link>
        </li>
      ))}
    </ul>
  );
}

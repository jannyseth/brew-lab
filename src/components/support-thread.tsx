import { formatDateTime } from "./ui";

export type ThreadMessage = {
  id: number;
  body: string;
  fromSupport: boolean;
  internal: boolean;
  authorName: string | null;
  createdAt: Date;
};

export const customerStatusLabels = { open: "Waiting for Brew Lab", waiting_customer: "Brew Lab replied", resolved: "Solved" };
export const staffStatusLabels = { open: "Needs reply", waiting_customer: "Waiting on customer", resolved: "Solved" };

/**
 * A support conversation. Customers see replies signed "Brew Lab Support";
 * staff also see who wrote each reply, and the internal notes.
 */
export function SupportThread({ messages, staffView }: { messages: ThreadMessage[]; staffView: boolean }) {
  return (
    <ol className="space-y-3">
      {messages.map((m) => {
        const who = m.fromSupport
          ? staffView
            ? `${m.authorName ?? "Former staff"}${m.internal ? " · internal note" : " · Brew Lab Support"}`
            : "Brew Lab Support"
          : staffView
            ? (m.authorName ?? "Customer")
            : "You";
        const tone = m.internal
          ? "border-dashed border-amber-400 bg-amber-50 dark:bg-amber-900/20"
          : m.fromSupport
            ? "border-line bg-accent-soft"
            : "border-line bg-card";
        return (
          <li key={m.id} className={`rounded-2xl border p-4 ${tone} ${m.fromSupport === staffView ? "ml-6" : "mr-6"}`}>
            <p className="text-xs text-muted">
              <span className="font-semibold text-foreground">{who}</span> · {formatDateTime(m.createdAt)}
            </p>
            <p className="mt-2 whitespace-pre-wrap break-words text-sm">{m.body}</p>
          </li>
        );
      })}
    </ol>
  );
}

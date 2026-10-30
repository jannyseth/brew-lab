import type { Metadata } from "next";
import { and, asc, eq, isNull } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { employees } from "@/db/schema";
import { AutoRefresh } from "@/components/auto-refresh";
import { Avatar } from "@/components/avatar";
import { ChatList } from "@/components/chat";
import { InviteForm, InviteLink, MessageButton, NewGroupForm } from "@/components/lounge-forms";
import { buttonSecondary, cardClass, formatDate } from "@/components/ui";
import { getManagedBranch } from "@/lib/branch-access";
import { requireUser } from "@/lib/session";
import { branchPeople, clockedHours, conversationList, openInvites, openShifts, thisWeek } from "@/lib/workers";
import { BranchHeader } from "../branch-header";

export const metadata: Metadata = { title: "Employee lounge" };

const timeOnly = (d: Date) =>
  new Intl.DateTimeFormat("en-PH", { timeStyle: "short", timeZone: process.env.NEXT_PUBLIC_TIMEZONE || undefined }).format(d);

export default async function LoungePage({ params }: PageProps<"/branch/[branchId]/lounge">) {
  const { branchId } = await params;
  const user = await requireUser(`/branch/${branchId}/lounge`);
  const branch = await getManagedBranch(Number(branchId), user);
  if (!branch) notFound();
  if (branch.status !== "approved") {
    return (
      <div>
        <BranchHeader branch={branch} />
        <p className={cardClass}>The lounge opens once the admin approves this branch.</p>
      </div>
    );
  }

  const [people, invites, chats, byHand] = await Promise.all([
    branchPeople(branch.id),
    openInvites(branch.id),
    conversationList(user.id, [branch.id]),
    db
      .select({ name: employees.name })
      .from(employees)
      .where(and(eq(employees.branchId, branch.id), eq(employees.active, true), isNull(employees.userId)))
      .orderBy(asc(employees.name)),
  ]);
  const team = people.filter((p) => p.employeeId !== null);
  const ids = team.map((p) => p.employeeId!);
  const week = thisWeek();
  const [onClock, hours] = await Promise.all([openShifts(ids), clockedHours(ids, week.start, week.end)]);

  return (
    <div>
      {/* Keeps "on the clock" and unread counts fresh. */}
      <AutoRefresh seconds={20} />
      <BranchHeader
        branch={branch}
        actions={
          <Link href={`/branch/${branch.id}/clock`} className={buttonSecondary}>
            Clock-in QR for the counter
          </Link>
        }
      />

      <div className="grid grid-cols-[minmax(0,1fr)] gap-8 xl:grid-cols-2">
        <section>
          <h2 className="mb-3 text-lg font-semibold">
            Team <span className="text-sm font-normal text-muted">· {onClock.size} on the clock</span>
          </h2>
          {team.length === 0 ? (
            <p className={cardClass}>No one has joined yet. Make an invite link below and send it to your new hire.</p>
          ) : (
            <ul className="divide-y divide-line rounded-2xl border border-line bg-card">
              {team.map((p) => {
                const since = onClock.get(p.employeeId!);
                const week = hours.get(p.employeeId!);
                return (
                  <li key={p.userId} className="flex items-center gap-3 px-4 py-3">
                    <Avatar src={p.image} name={p.name} size={40} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{p.name}</p>
                      <p className="text-xs text-muted">
                        {p.position} · {(week?.hours ?? 0).toFixed(1)} h this week
                      </p>
                    </div>
                    <span
                      className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${
                        since ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" : "bg-background text-muted ring-1 ring-line"
                      }`}
                    >
                      {since ? `On since ${timeOnly(since)}` : "Off"}
                    </span>
                    <MessageButton branchId={branch.id} userId={p.userId} />
                  </li>
                );
              })}
            </ul>
          )}
          {byHand.length > 0 && (
            <p className="mt-2 text-xs text-muted">
              Added by hand, without the app: {byHand.map((e) => e.name).join(", ")}. Send them an invite link so they can clock in and chat.
            </p>
          )}

          <h2 className="mb-3 mt-8 text-lg font-semibold">Hire</h2>
          <div className={cardClass}>
            <p className="mb-3 text-sm text-muted">Each link lets one person make a worker account and join this branch.</p>
            <InviteForm branchId={branch.id} />
            {invites.map((i) => (
              <InviteLink
                key={i.token}
                path={`/join/${i.token}`}
                branchId={branch.id}
                token={i.token}
                label={`${i.position} · open until ${formatDate(i.expiresAt)}`}
              />
            ))}
          </div>
          <p className="mt-2 text-xs text-muted">To remove someone, archive them on the Payroll tab. They lose the lounge and the clock right away.</p>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold">Chats</h2>
          <ChatList chats={chats} hrefFor={(id) => `/branch/${branch.id}/lounge/${id}`} />
          <details className={`${cardClass} mt-4`}>
            <summary className="cursor-pointer font-medium">New group chat</summary>
            <div className="mt-4">
              <NewGroupForm branchId={branch.id} people={team.map((p) => ({ userId: p.userId, name: p.name }))} />
            </div>
          </details>
        </section>
      </div>
    </div>
  );
}

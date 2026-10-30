import type { Metadata } from "next";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { branches, employees, timeEntries } from "@/db/schema";
import { AutoRefresh } from "@/components/auto-refresh";
import { ChatList } from "@/components/chat";
import { MessageButton, NewGroupForm } from "@/components/lounge-forms";
import { cardClass, formatDateTime, PageTitle } from "@/components/ui";
import { formatCents } from "@/lib/drink";
import { requireRole } from "@/lib/session";
import { branchPeople, clockedHours, conversationList, openShifts, thisWeek } from "@/lib/workers";

export const metadata: Metadata = { title: "Work" };

const timeOnly = (d: Date) =>
  new Intl.DateTimeFormat("en-PH", { timeStyle: "short", timeZone: process.env.NEXT_PUBLIC_TIMEZONE || undefined }).format(d);

/** A worker's home: their branches, the clock, hours, chats and recent shifts. */
export default async function WorkPage() {
  const user = await requireRole(["worker"], "/work");
  const jobs = await db
    .select({ employeeId: employees.id, position: employees.position, rate: employees.hourlyRateCents, branchId: branches.id, branchName: branches.name, ownerId: branches.managerId })
    .from(employees)
    .innerJoin(branches, eq(employees.branchId, branches.id))
    .where(and(eq(employees.userId, user.id), eq(employees.active, true), eq(branches.status, "approved")));
  const ids = jobs.map((j) => j.employeeId);
  const week = thisWeek();
  const [onClock, hours, chats, shifts, coworkers] = await Promise.all([
    openShifts(ids),
    clockedHours(ids, week.start, week.end),
    conversationList(user.id, jobs.map((j) => j.branchId)),
    ids.length
      ? db
          .select({ id: timeEntries.id, clockIn: timeEntries.clockIn, clockOut: timeEntries.clockOut, source: timeEntries.source, branchName: branches.name })
          .from(timeEntries)
          .innerJoin(branches, eq(timeEntries.branchId, branches.id))
          .where(inArray(timeEntries.employeeId, ids))
          .orderBy(desc(timeEntries.clockIn))
          .limit(10)
      : [],
    Promise.all(jobs.map((j) => branchPeople(j.branchId))),
  ]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <AutoRefresh seconds={20} />
      <PageTitle title={`Hi, ${(user.name || "there").split(" ")[0]}`} subtitle="Scan the QR code on the counter screen to clock in or out." />

      {jobs.length === 0 && <p className={cardClass}>You&apos;re not on a team yet. Ask a branch for an invite link.</p>}

      <div className="space-y-4">
        {jobs.map((j, i) => {
          const since = onClock.get(j.employeeId);
          const others = coworkers[i].filter((p) => p.userId !== user.id && p.userId !== j.ownerId);
          return (
            <section key={j.employeeId} className={cardClass}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-display text-xl font-semibold">{j.branchName}</h2>
                  <p className="text-sm text-muted">
                    {j.position} · {formatCents(j.rate)}/hr · {(hours.get(j.employeeId)?.hours ?? 0).toFixed(1)} h this week
                  </p>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-sm font-semibold ${
                    since ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" : "bg-background text-muted ring-1 ring-line"
                  }`}
                >
                  {since ? `On the clock since ${timeOnly(since)}` : "Off the clock"}
                </span>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <MessageButton branchId={j.branchId} userId={j.ownerId} label="Message the owner" />
              </div>
              <details className="mt-4">
                <summary className="cursor-pointer text-sm font-medium text-accent">New group chat</summary>
                <div className="mt-3">
                  <NewGroupForm branchId={j.branchId} people={[...coworkers[i].filter((p) => p.userId === j.ownerId), ...others].map((p) => ({ userId: p.userId, name: p.name }))} />
                </div>
              </details>
            </section>
          );
        })}
      </div>

      {jobs.length > 0 && (
        <>
          <h2 className="mb-3 mt-10 text-lg font-semibold">Chats</h2>
          <ChatList chats={chats} hrefFor={(id) => `/work/chat/${id}`} showBranch={jobs.length > 1} />
        </>
      )}

      {shifts.length > 0 && (
        <>
          <h2 className="mb-3 mt-10 text-lg font-semibold">Recent shifts</h2>
          <ul className="divide-y divide-line rounded-2xl border border-line bg-card text-sm">
            {shifts.map((s) => (
              <li key={s.id} className="flex flex-wrap justify-between gap-2 px-4 py-2.5">
                <span>
                  {formatDateTime(s.clockIn)} → {s.clockOut ? timeOnly(s.clockOut) : "now"}
                  {jobs.length > 1 && <span className="text-muted"> · {s.branchName}</span>}
                  {s.source === "manual" && <span className="text-muted"> · set by the owner</span>}
                </span>
                <span className="tabular-nums text-muted">
                  {s.clockOut ? `${((s.clockOut.getTime() - s.clockIn.getTime()) / 3_600_000).toFixed(2)} h` : "in progress"}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

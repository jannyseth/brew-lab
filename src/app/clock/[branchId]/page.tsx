import type { Metadata } from "next";
import { and, eq, isNull } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/db";
import { branches, timeEntries } from "@/db/schema";
import { cardClass } from "@/components/ui";
import { requireUser } from "@/lib/session";
import { branchMembership } from "@/lib/workers";
import { PunchButton } from "./punch-button";

export const metadata: Metadata = { title: "Clock in", robots: { index: false } };

/** Where the counter QR code leads: a worker's phone, ready to clock in or out. */
export default async function ClockPage({ params, searchParams }: PageProps<"/clock/[branchId]">) {
  const { branchId } = await params;
  const { c } = await searchParams;
  const code = typeof c === "string" ? c : "";
  const user = await requireUser(`/clock/${branchId}${code ? `?c=${code}` : ""}`);
  const id = Number(branchId);
  const membership = await branchMembership(user.id, id);
  const [branch] = Number.isInteger(id) ? await db.select({ name: branches.name }).from(branches).where(eq(branches.id, id)) : [];

  let body: React.ReactNode;
  if (!branch || !membership || membership.kind !== "worker") {
    body = <p className={cardClass}>This account isn&apos;t on this branch&apos;s team. Sign in with your worker account, or ask the branch for an invite link.</p>;
  } else if (!code) {
    body = <p className={cardClass}>Scan the QR code on the counter screen to clock in or out.</p>;
  } else {
    const [open] = await db
      .select({ id: timeEntries.id })
      .from(timeEntries)
      .where(and(eq(timeEntries.employeeId, membership.employeeId), isNull(timeEntries.clockOut)));
    body = <PunchButton branchId={id} code={code} clockedIn={!!open} />;
  }

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-8 px-4 py-16 text-center">
      <div>
        <p className="text-sm font-semibold uppercase tracking-widest text-accent">Time clock</p>
        <h1 className="font-display text-3xl font-semibold">{branch?.name ?? "Brew Lab"}</h1>
        <p className="mt-1 text-sm text-muted">Signed in as {user.name || user.email}</p>
      </div>
      {body}
      <Link href="/work" className="text-sm font-medium text-accent hover:underline">
        Go to your work page →
      </Link>
    </div>
  );
}

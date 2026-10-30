import type { Metadata } from "next";
import Link from "next/link";
import { cardClass } from "@/components/ui";
import { formatCents } from "@/lib/drink";
import { getSession } from "@/lib/session";
import { branchMembership, inviteDetails } from "@/lib/workers";
import { SignUpForm } from "../../sign-up/sign-up-form";
import { JoinButton } from "./join-button";

export const metadata: Metadata = { title: "Join the team", robots: { index: false } };

/** Where a branch's hiring link leads: make a worker account (or use yours) and join. */
export default async function JoinPage({ params }: PageProps<"/join/[token]">) {
  const { token } = await params;
  const [details, session] = await Promise.all([inviteDetails(token), getSession()]);
  const me = session?.user;
  const already = me && details ? await branchMembership(me.id, details.invite.branchId) : null;

  let body: React.ReactNode;
  if (already) {
    body = (
      <p className={cardClass}>
        You&apos;re on the team.{" "}
        <Link href={already.kind === "owner" ? `/branch/${details!.invite.branchId}/lounge` : "/work"} className="font-medium text-accent">
          Open your work page →
        </Link>
      </p>
    );
  } else if (!details?.usable) {
    body = <p className={cardClass}>This invite link has expired or was already used. Ask the branch for a new one.</p>;
  } else if (!me) {
    body = (
      <>
        <SignUpForm invite={token} />
        <p className="mt-6 text-center text-sm text-muted">
          Already have an account?{" "}
          <Link href={`/sign-in?next=${encodeURIComponent(`/join/${token}`)}`} className="font-medium text-accent">
            Sign in
          </Link>
        </p>
      </>
    );
  } else if (me.role === "worker" || me.role === "customer") {
    body = (
      <>
        {me.role === "customer" && (
          <p className="mb-4 rounded-xl bg-accent-soft px-4 py-3 text-sm">
            Your account ({me.email}) becomes a worker account. Your bean coins and past orders are kept.
          </p>
        )}
        <JoinButton token={token} branchName={details.branchName} />
      </>
    );
  } else {
    body = <p className={cardClass}>This account can&apos;t join as a worker. Sign out and use another account.</p>;
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <p className="text-sm font-semibold uppercase tracking-widest text-accent">You&apos;re invited</p>
      <h1 className="font-display text-3xl font-semibold tracking-tight">{details?.branchName ?? "Join a Brew Lab team"}</h1>
      {details && (
        <div className={`${cardClass} mt-4`}>
          <p className="font-medium">{details.invite.position}</p>
          <p className="text-sm text-muted">
            {formatCents(details.invite.hourlyRateCents)} per hour · {details.address}
          </p>
          <p className="mt-2 text-xs text-muted">
            Your employer is {details.branchName}. Brew Lab only provides the app for clocking in and team chat.
          </p>
        </div>
      )}
      <div className="mt-6">{body}</div>
    </div>
  );
}

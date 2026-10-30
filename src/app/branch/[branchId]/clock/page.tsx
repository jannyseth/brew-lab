import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getManagedBranch } from "@/lib/branch-access";
import { requireUser } from "@/lib/session";
import { BranchHeader } from "../branch-header";
import { CounterClock } from "./counter-clock";

export const metadata: Metadata = { title: "Clock-in QR" };

export default async function CounterClockPage({ params }: PageProps<"/branch/[branchId]/clock">) {
  const { branchId } = await params;
  const user = await requireUser(`/branch/${branchId}/clock`);
  const branch = await getManagedBranch(Number(branchId), user);
  if (!branch || branch.status !== "approved") notFound();
  return (
    <div>
      <BranchHeader branch={branch} />
      <p className="mb-4 text-sm text-muted">Leave this open on a tablet or screen at the counter. Your workers scan it when they start and end a shift.</p>
      <CounterClock branchId={branch.id} />
    </div>
  );
}

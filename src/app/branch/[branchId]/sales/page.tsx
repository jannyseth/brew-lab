import { redirect } from "next/navigation";

// Sales are on the branch's "Dashboard & sales" tab now.
export default async function SalesPage({ params }: PageProps<"/branch/[branchId]/sales">) {
  redirect(`/branch/${(await params).branchId}`);
}

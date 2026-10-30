import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ChatThread } from "@/components/chat";
import { getManagedBranch } from "@/lib/branch-access";
import { requireUser } from "@/lib/session";
import { chatPageData } from "@/lib/workers";

export const metadata: Metadata = { title: "Chat" };

export default async function BranchChatPage({ params }: PageProps<"/branch/[branchId]/lounge/[conversationId]">) {
  const { branchId, conversationId } = await params;
  const user = await requireUser(`/branch/${branchId}/lounge/${conversationId}`);
  const branch = await getManagedBranch(Number(branchId), user);
  if (!branch) notFound();
  const chat = await chatPageData(user.id, Number(conversationId));
  if (!chat || chat.branchId !== branch.id) notFound();
  return <ChatThread {...chat} backHref={`/branch/${branch.id}/lounge`} viewerId={user.id} />;
}

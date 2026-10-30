import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ChatThread } from "@/components/chat";
import { requireRole } from "@/lib/session";
import { chatPageData } from "@/lib/workers";

export const metadata: Metadata = { title: "Chat" };

export default async function WorkChatPage({ params }: PageProps<"/work/chat/[conversationId]">) {
  const { conversationId } = await params;
  const user = await requireRole(["worker"], `/work/chat/${conversationId}`);
  const chat = await chatPageData(user.id, Number(conversationId));
  if (!chat) notFound();
  return (
    <div className="px-4 py-6">
      <ChatThread {...chat} backHref="/work" viewerId={user.id} />
    </div>
  );
}

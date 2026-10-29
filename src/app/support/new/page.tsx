import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { openTicket } from "@/app/actions/support";
import { ActionForm } from "@/components/action-form";
import { inputClass, PageTitle } from "@/components/ui";
import { requireUser } from "@/lib/session";
import { isSupportStaff, MESSAGE_MAX, SUBJECT_MAX } from "@/lib/support";

export const metadata: Metadata = { title: "Message us" };

export default async function NewTicketPage({ searchParams }: PageProps<"/support/new">) {
  const { topic } = await searchParams;
  const about = typeof topic === "string" ? topic.slice(0, 200) : "";
  const me = await requireUser(`/support/new${about ? `?topic=${encodeURIComponent(about)}` : ""}`);
  if (isSupportStaff(me.role)) redirect("/admin/support");

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <PageTitle title="Message us" subtitle="A person from the Brew Lab team will reply, usually within one business day." />
      <ActionForm action={openTicket} submitLabel="Send message">
        {about && <input type="hidden" name="topic" value={about} />}
        <label className="block text-sm font-medium">
          Subject
          <input name="subject" required minLength={3} maxLength={SUBJECT_MAX} defaultValue={about} className={inputClass} />
        </label>
        <label className="mt-4 block text-sm font-medium">
          Message
          <textarea
            name="body"
            required
            minLength={2}
            maxLength={MESSAGE_MAX}
            rows={6}
            placeholder="Tell us what happened. Include your order number if it's about an order."
            className={inputClass}
          />
        </label>
        <p className="mt-2 text-xs text-muted">Please don&apos;t send passwords, codes or card numbers. Brew Lab will never ask for them.</p>
      </ActionForm>
      <p className="mt-8 text-sm">
        <Link href="/support" className="text-accent hover:underline">
          ← Your messages
        </Link>
      </p>
    </div>
  );
}

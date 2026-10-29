import type { Metadata } from "next";
import Link from "next/link";
import { buttonPrimary, PageTitle } from "@/components/ui";
import { faq, FACEBOOK_URL } from "@/lib/faq";

export const metadata: Metadata = {
  title: "FAQ",
  description: "Answers about ordering, pickup, bean coins, signature drinks and your account.",
};

const askAbout = (q: string) => `/support/new?topic=${encodeURIComponent(q)}`;

export default function FaqPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <PageTitle title="Frequently asked questions" subtitle="Answers about ordering, pickup, bean coins and your account." />
      <div className="space-y-10">
        {faq.map((section) => (
          <section key={section.title}>
            <h2 className="mb-3 text-lg font-semibold">{section.title}</h2>
            <div className="divide-y divide-line rounded-2xl border border-line bg-card">
              {section.items.map((item) => (
                <details key={item.q} className="group px-4 py-3">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium">
                    {item.q}
                    <span aria-hidden className="text-muted transition group-open:rotate-45">
                      +
                    </span>
                  </summary>
                  <p className="mt-2 text-sm text-muted">{item.a}</p>
                  <Link href={askAbout(item.q)} className="mt-2 inline-block text-xs font-medium text-accent hover:underline">
                    Still need help? Message us
                  </Link>
                </details>
              ))}
            </div>
          </section>
        ))}
      </div>
      <div className="mt-10 rounded-2xl bg-accent-soft p-5">
        <p className="font-semibold">Didn&apos;t find your answer?</p>
        <p className="mt-1 text-sm text-muted">A person from the Brew Lab team will reply, usually within one business day.</p>
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <Link href="/support/new" className={buttonPrimary}>
            Message us
          </Link>
          <Link href="/support" className="text-sm text-accent hover:underline">
            Your messages
          </Link>
          <a href={FACEBOOK_URL} target="_blank" rel="noopener noreferrer" className="text-sm text-muted hover:text-accent">
            or Facebook
          </a>
        </div>
      </div>
    </div>
  );
}

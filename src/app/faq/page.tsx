import type { Metadata } from "next";
import { PageTitle } from "@/components/ui";
import { faq, FACEBOOK_URL } from "@/lib/faq";

export const metadata: Metadata = {
  title: "FAQ",
  description: "Answers about ordering, pickup, bean coins, signature drinks and your account.",
};

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
                </details>
              ))}
            </div>
          </section>
        ))}
      </div>
      <p className="mt-10 text-sm text-muted">
        Prefer a person?{" "}
        <a href={FACEBOOK_URL} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
          Message us on Facebook
        </a>
        .
      </p>
    </div>
  );
}

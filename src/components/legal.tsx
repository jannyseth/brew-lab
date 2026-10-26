// Shared layout for the Privacy, Terms and Security pages.

export const LEGAL_UPDATED = "October 27, 2026";
export const contactEmail = () => process.env.GMAIL_USER || "the email address shown in our sign-up emails";

export function LegalPage({ title, intro, children }: { title: string; intro: string; children: React.ReactNode }) {
  return (
    <article className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="font-display text-4xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-2 text-sm text-muted">Last updated {LEGAL_UPDATED}</p>
      <p className="mt-6 text-lg leading-relaxed">{intro}</p>
      <div className="mt-8 space-y-8 leading-relaxed [&_h2]:font-display [&_h2]:text-2xl [&_h2]:font-semibold [&_li]:mt-1 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:mt-3 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-6">
        {children}
      </div>
    </article>
  );
}

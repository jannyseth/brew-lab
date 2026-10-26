import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { branches, branchLicenses, user } from "@/db/schema";
import { PrintButton } from "@/components/print-button";
import { QuotaProgress } from "@/components/quota-progress";
import { Badge, formatDate } from "@/components/ui";
import { formatCents } from "@/lib/drink";
import { branchSalesBetween } from "@/lib/licenses";
import { requireRole } from "@/lib/session";

export const metadata: Metadata = { title: "Branch license" };

export default async function LicensePage({ params }: PageProps<"/licenses/[id]">) {
  const { id } = await params;
  const viewer = await requireRole(["super_admin", "branch_manager"], `/licenses/${id}`);
  const licenseId = Number(id);
  if (!Number.isInteger(licenseId)) notFound();

  const [row] = await db
    .select({ license: branchLicenses, branch: branches, ownerName: user.name, ownerEmail: user.email })
    .from(branchLicenses)
    .innerJoin(branches, eq(branchLicenses.branchId, branches.id))
    .innerJoin(user, eq(branches.managerId, user.id))
    .where(eq(branchLicenses.id, licenseId));
  // Only the admin and the branch's own owner may see its license.
  if (!row || (viewer.role === "branch_manager" && row.branch.managerId !== viewer.id)) notFound();

  const { license, branch } = row;
  const sales = license.salesCents ?? (await branchSalesBetween(branch.id, license.issuedAt, license.expiresAt));
  const back = viewer.role === "super_admin" ? "/admin/branches" : "/branch";

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-6 flex items-center justify-between gap-4 print:hidden">
        <Link href={back} className="text-sm text-muted hover:text-accent">
          ← Back
        </Link>
        <PrintButton />
      </div>

      <article className="rounded-3xl border-4 border-double border-accent bg-card p-8 sm:p-12 print:border-black">
        <header className="text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-accent">Brew Lab</p>
          <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight">Branch Operating License</h1>
          <p className="mt-2 text-muted">License No. {license.licenseNumber}</p>
          <div className="mt-3 flex justify-center print:hidden">
            <Badge status={license.status === "active" && license.expiresAt < new Date() ? "expired" : license.status} />
          </div>
        </header>

        <p className="mt-10 text-center leading-relaxed">
          This certifies that <span className="font-semibold">{branch.name}</span>, located at {branch.address}, operated by{" "}
          <span className="font-semibold">{row.ownerName || row.ownerEmail}</span>, is licensed to operate as a Brew Lab branch
          and to accept orders through the Brew Lab platform for the period below.
        </p>

        <dl className="mt-10 grid gap-6 text-center sm:grid-cols-3">
          <div>
            <dt className="text-xs uppercase tracking-wider text-muted">Valid from</dt>
            <dd className="mt-1 font-semibold">{formatDate(license.issuedAt)}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wider text-muted">Valid until</dt>
            <dd className="mt-1 font-semibold">{formatDate(license.expiresAt)}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wider text-muted">Renewal quota</dt>
            <dd className="mt-1 font-semibold">{formatCents(license.quotaCents)} in sales</dd>
          </div>
        </dl>

        <div className="mx-auto mt-8 max-w-md">
          <QuotaProgress salesCents={sales} quotaCents={license.quotaCents} />
        </div>

        <section className="mt-10 text-sm leading-relaxed text-muted">
          <h2 className="font-semibold text-foreground">Conditions</h2>
          <ol className="mt-2 list-decimal space-y-1 pl-5">
            <li>This license is valid for one (1) year from the date of issue.</li>
            <li>
              It renews automatically for another year if the branch records at least {formatCents(license.quotaCents)} in paid
              sales through Brew Lab during the license year. Otherwise it expires, and the branch stops accepting online
              orders until Brew Lab issues a new license.
            </li>
            <li>The license is issued to the branch and owner named above and may not be transferred.</li>
            <li>
              Brew Lab may suspend or revoke this license for breach of the Terms of Use, food safety or data privacy
              obligations, or applicable law.
            </li>
            <li>This license covers use of the Brew Lab platform only and does not replace permits required by law.</li>
          </ol>
        </section>

        <footer className="mt-12 grid gap-10 text-center text-sm sm:grid-cols-2">
          <div>
            <div className="mx-auto h-px w-48 bg-foreground/40" />
            <p className="mt-2">Brew Lab Administrator</p>
          </div>
          <div>
            <div className="mx-auto h-px w-48 bg-foreground/40" />
            <p className="mt-2">Branch Owner</p>
          </div>
        </footer>
      </article>
    </div>
  );
}

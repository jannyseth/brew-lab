import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { buttonPrimary, cardClass, formatDate } from "@/components/ui";
import { formatCents } from "@/lib/drink";
import { loadSharedReceipt, weekLabel } from "@/lib/receipt-share";

export async function generateMetadata({ params }: PageProps<"/r/[token]">): Promise<Metadata> {
  await connection();
  const data = await loadSharedReceipt((await params).token);
  if (!data) return { title: "Not found" };
  const title = data.kind === "order" ? `A Brew Lab order from ${data.branch}` : `A week at Brew Lab · ${weekLabel(data.weekStart)}`;
  // Shared links are personal; keep them out of search results.
  return { title, robots: { index: false }, openGraph: { title, siteName: "Brew Lab" } };
}

/** The page behind a shared receipt link: drinks and totals only, nothing personal. */
export default async function SharedReceiptPage({ params }: PageProps<"/r/[token]">) {
  await connection();
  const data = await loadSharedReceipt((await params).token);
  if (!data) notFound();

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <article className={`${cardClass} p-6`}>
        <p className="text-xs font-semibold uppercase tracking-widest text-accent">Brew Lab</p>
        {data.kind === "order" ? (
          <>
            <h1 className="mt-1 font-display text-3xl font-semibold">{data.branch}</h1>
            <p className="text-sm text-muted">{formatDate(data.date)}</p>
            <ul className="mt-5 space-y-2 border-t border-dashed border-line pt-4">
              {data.items.map((i, n) => (
                <li key={n} className="flex justify-between gap-4">
                  <span>
                    {i.quantity} × {i.name}
                  </span>
                  <span className="tabular-nums">{formatCents(i.cents)}</span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <>
            <h1 className="mt-1 font-display text-3xl font-semibold">My week of coffee</h1>
            <p className="text-sm text-muted">{weekLabel(data.weekStart)}</p>
            <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-dashed border-line pt-4">
              <div>
                <dt className="text-xs text-muted">Drinks</dt>
                <dd className="font-display text-3xl font-semibold">{data.drinks}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Orders</dt>
                <dd className="font-display text-3xl font-semibold">{data.orders}</dd>
              </div>
            </dl>
            {data.favorite && <p className="mt-4">Favourite: <span className="font-semibold">{data.favorite}</span></p>}
            <p className="mt-1 text-sm text-muted">{data.branches.join(" · ")}</p>
          </>
        )}
        <div className="mt-5 flex justify-between border-t border-dashed border-line pt-4 font-semibold">
          <span>Total</span>
          <span className="tabular-nums">{formatCents(data.totalCents)}</span>
        </div>
      </article>
      <Link href="/menu" className={`${buttonPrimary} mt-6 block text-center`}>
        Order your own at Brew Lab
      </Link>
    </div>
  );
}

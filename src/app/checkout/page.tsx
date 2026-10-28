import type { Metadata } from "next";
import { asc } from "drizzle-orm";
import { db } from "@/db";
import { branches } from "@/db/schema";
import { PageTitle } from "@/components/ui";
import { coinBalance } from "@/lib/coins";
import { imageUrl } from "@/lib/images";
import { isOpenBranch, settleExpiredLicenses } from "@/lib/licenses";
import { requireRole } from "@/lib/session";
import { CheckoutForm } from "./checkout-form";

export const metadata: Metadata = { title: "Checkout" };

export default async function CheckoutPage() {
  const user = await requireRole(["customer"], "/checkout");
  await settleExpiredLicenses();
  const openBranches = await db
    .select({ id: branches.id, name: branches.name, address: branches.address, hours: branches.hours, imageKey: branches.imageKey })
    .from(branches)
    .where(isOpenBranch)
    .orderBy(asc(branches.name));
  const coins = await coinBalance(user.id);

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <PageTitle title="Checkout" subtitle="Pick your branch. You'll pay at the counter when you collect." />
      <CheckoutForm branches={openBranches.map(({ imageKey, ...b }) => ({ ...b, imageUrl: imageUrl(imageKey) }))} defaultName={user.name || user.email.split("@")[0]} coins={coins.spendable} />
    </div>
  );
}

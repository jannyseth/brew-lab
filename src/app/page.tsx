import Link from "next/link";
import { Suspense } from "react";
import { getSession } from "@/lib/session";
import { CupPreview } from "@/components/cup-preview";

export default function Home() {
  return (
    <div className="mx-auto grid max-w-5xl items-center gap-10 px-4 py-16 md:grid-cols-2 md:py-24">
      <div>
        <p className="text-sm font-semibold uppercase tracking-widest text-accent">Your coffee, your way</p>
        <h1 className="mt-3 font-display text-5xl font-semibold leading-tight tracking-tight md:text-6xl">
          Pick a classic or build your own.
        </h1>
        <p className="mt-5 max-w-md text-lg text-muted">
          Choose from our menu, or start from a single shot and pick the size, milk, syrups and toppings.
          The price updates as you go.
        </p>
        <Suspense fallback={<div className="mt-8 h-12" />}>
          <HomeActions />
        </Suspense>
      </div>
      <div className="flex justify-center">
        <CupPreview size="large" iced={false} shots={2} milk syrup topping="whip" />
      </div>
    </div>
  );
}

function CustomerActions() {
  return (
    <div className="mt-8 flex flex-wrap gap-3">
      <Link
        href="/menu/build-your-own"
        className="rounded-full bg-accent px-6 py-3 font-medium text-accent-contrast hover:opacity-90"
      >
        Build your own
      </Link>
      <Link href="/menu" className="rounded-full border border-line px-6 py-3 font-medium hover:border-accent">
        Browse the menu
      </Link>
    </div>
  );
}

/** Branch owners and the admin can't order, so they get a link to their dashboard instead. */
async function HomeActions() {
  const session = await getSession();
  const role = session?.user.role;
  if (role === "branch_manager" || role === "branch_applicant" || role === "super_admin") {
    return (
      <div className="mt-8">
        <Link
          href={role === "super_admin" ? "/admin" : "/branch"}
          className="rounded-full bg-accent px-6 py-3 font-medium text-accent-contrast hover:opacity-90"
        >
          Go to your dashboard
        </Link>
      </div>
    );
  }
  return <CustomerActions />;
}

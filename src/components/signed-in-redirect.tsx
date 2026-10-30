import { Suspense } from "react";
import { redirectIfSignedIn } from "@/lib/session";

type Next = Promise<{ next?: string | string[] }>;

async function Check({ searchParams }: { searchParams?: Next }) {
  await redirectIfSignedIn((await searchParams)?.next);
  return null;
}

/** On the sign-in and sign-up pages: someone already signed in is sent on instead of seeing the form. */
export function SignedInRedirect({ searchParams }: { searchParams?: Next }) {
  return (
    <Suspense fallback={null}>
      <Check searchParams={searchParams} />
    </Suspense>
  );
}

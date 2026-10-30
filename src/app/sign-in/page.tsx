import type { Metadata } from "next";
import { SignedInRedirect } from "@/components/signed-in-redirect";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = { title: "Sign in" };

export default function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  return (
    <div className="mx-auto max-w-sm px-4 py-16">
      <SignedInRedirect searchParams={searchParams} />
      <h1 className="font-display text-3xl font-semibold tracking-tight">Sign in</h1>
      <p className="mt-2 text-muted">Welcome back to Brew Lab.</p>
      <SignInForm />
    </div>
  );
}

import type { Metadata } from "next";
import { SignedInRedirect } from "@/components/signed-in-redirect";
import { SignUpForm } from "./sign-up-form";

export const metadata: Metadata = { title: "Create an account" };

export default function SignUpPage() {
  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <SignedInRedirect />
      <h1 className="font-display text-3xl font-semibold tracking-tight">Create an account</h1>
      <p className="mt-2 text-muted">Order as a customer, or run a Brew Lab branch.</p>
      <SignUpForm />
    </div>
  );
}

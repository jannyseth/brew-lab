import Link from "next/link";
import type { Role } from "@/lib/auth";
import { getSession } from "@/lib/session";
import { CartLink } from "./cart";
import { SignOutButton } from "./sign-out-button";

// Each account type sees only its own area: customers never see the branch
// dashboard, and branch owners and the admin don't get a cart.
export async function UserMenu() {
  const session = await getSession();
  if (!session) {
    return (
      <>
        <CartLink />
        <Link href="/sign-in" className="hover:text-accent">
          Sign in
        </Link>
        <Link href="/sign-up" className="rounded-full bg-accent px-4 py-1.5 text-accent-contrast hover:opacity-90">
          Sign up
        </Link>
      </>
    );
  }

  const role = session.user.role as Role;
  return (
    <>
      {role === "customer" && (
        <>
          <CartLink />
          <Link href="/orders" className="hover:text-accent">
            Orders
          </Link>
          <Link href="/saved" className="hover:text-accent">
            Saved
          </Link>
        </>
      )}
      {(role === "branch_manager" || role === "branch_applicant") && (
        <Link href="/branch" className="hover:text-accent">
          Branch dashboard
        </Link>
      )}
      {role === "super_admin" && (
        <Link href="/admin" className="hover:text-accent">
          Admin
        </Link>
      )}
      <SignOutButton />
    </>
  );
}

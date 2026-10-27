import Link from "next/link";
import type { Role } from "@/lib/auth";
import { getSession } from "@/lib/session";
import { Avatar } from "./avatar";
import { CartLink } from "./cart";
import { SignOutButton } from "./sign-out-button";

const menuLinks = (
  <>
    <Link href="/menu" className="hover:text-accent">
      Menu
    </Link>
    <Link href="/menu/build-your-own" className="hidden hover:text-accent sm:inline">
      Build your own
    </Link>
  </>
);

// Each account type sees only its own area: customers never see the branch
// dashboard, and branch owners and the admin don't see the menu or a cart.
export async function UserMenu() {
  const session = await getSession();
  if (!session) {
    return (
      <>
        {menuLinks}
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
          {menuLinks}
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
      <Link href="/profile" className="flex items-center gap-2 hover:text-accent" aria-label="Your profile">
        <Avatar src={session.user.image} name={session.user.name || session.user.email} size={28} />
      </Link>
      <SignOutButton />
    </>
  );
}

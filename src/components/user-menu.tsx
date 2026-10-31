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
    <Link href="/menu/build-your-own" className="hover:text-accent">
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
          <Link href="/rewards" className="hover:text-accent">
            Saved &amp; rewards
          </Link>
        </>
      )}
      {(role === "branch_manager" || role === "branch_applicant") && (
        <Link href="/branch" className="hover:text-accent">
          Branch dashboard
        </Link>
      )}
      {role === "worker" && (
        <>
          <Link href="/work/orders" className="hover:text-accent">
            Orders
          </Link>
          <Link href="/work" className="hover:text-accent">
            Work
          </Link>
        </>
      )}
      {role === "super_admin" && (
        <Link href="/admin" className="hover:text-accent">
          Admin
        </Link>
      )}
      {role === "support_agent" && (
        <Link href="/admin/support" className="hover:text-accent">
          Support inbox
        </Link>
      )}
      <Link href={role === "customer" ? "/account" : "/profile"} className="flex items-center gap-2 hover:text-accent" aria-label="Your account">
        <Avatar src={session.user.image} name={session.user.name || session.user.email} size={28} />
      </Link>
      <SignOutButton />
    </>
  );
}

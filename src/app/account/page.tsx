import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";

// Sends each account to its own home after signing in.
export default async function AccountPage() {
  const user = await requireUser("/account");
  if (user.role === "needs_two_factor") redirect("/account/two-factor");
  if (user.role === "super_admin") redirect("/admin");
  if (user.role === "support_agent") redirect("/admin/support");
  if (user.role === "branch_manager" || user.role === "branch_applicant") redirect("/branch");
  redirect("/menu");
}

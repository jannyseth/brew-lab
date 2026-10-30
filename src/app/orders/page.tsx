import { redirect } from "next/navigation";

// All orders are on the Account page now.
export default function OrdersPage() {
  redirect("/account");
}

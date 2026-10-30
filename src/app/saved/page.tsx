import { redirect } from "next/navigation";

// Saved drinks now live on the Saved & rewards page.
export default function SavedPage() {
  redirect("/rewards#saved");
}

"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useCart } from "@/components/cart";

// The cart is a drawer now; old links to /cart open it over the menu.
export default function CartPage() {
  const { open } = useCart();
  const router = useRouter();
  useEffect(() => {
    router.replace("/menu");
    open();
  }, [open, router]);
  return null;
}

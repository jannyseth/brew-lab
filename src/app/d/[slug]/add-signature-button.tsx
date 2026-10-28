"use client";

import Link from "next/link";
import { useState } from "react";
import { useCart, type CartLine } from "@/components/cart";
import { buttonPrimary } from "@/components/ui";

export function AddSignatureButton({ line }: { line: Omit<CartLine, "id"> }) {
  const cart = useCart();
  const [added, setAdded] = useState(false);
  return added ? (
    <Link href="/cart" className={buttonPrimary}>
      Added ✓ View order
    </Link>
  ) : (
    <button
      type="button"
      className={buttonPrimary}
      onClick={() => {
        cart.add(line);
        setAdded(true);
      }}
    >
      Add to order
    </button>
  );
}

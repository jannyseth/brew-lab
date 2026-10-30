"use client";

import { useState } from "react";
import { useCart, type CartLine } from "@/components/cart";
import { buttonPrimary } from "@/components/ui";

export function AddSignatureButton({ line }: { line: Omit<CartLine, "id"> }) {
  const cart = useCart();
  const [added, setAdded] = useState(false);
  return added ? (
    <button type="button" onClick={cart.open} className={buttonPrimary}>
      Added ✓ View order
    </button>
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

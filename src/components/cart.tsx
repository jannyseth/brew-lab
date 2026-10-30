"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { Selection } from "@/lib/drink";

// The cart lives in the browser for convenience only. Prices here are for
// display; the server recomputes every price when the order is placed.

export type CartLine = {
  id: string;
  slug: string;
  drinkName: string;
  summary: string;
  selection: Selection;
  unitPriceCents: number;
  quantity: number;
  /** Slug of a published signature drink, so its creator earns bean coins. */
  signature?: string;
};

type CartContext = {
  lines: CartLine[];
  add: (line: Omit<CartLine, "id">) => void;
  setQuantity: (id: string, quantity: number) => void;
  clear: () => void;
  /** The cart and checkout open as a drawer over the current page. */
  isOpen: boolean;
  open: () => void;
  close: () => void;
};

const Context = createContext<CartContext | null>(null);
const STORAGE_KEY = "brew-lab-cart";
export const MAX_QUANTITY = 10;

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reading browser storage after hydration
      if (saved) setLines(JSON.parse(saved));
    } catch {}
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
    } catch {}
  }, [lines, loaded]);

  const value: CartContext = {
    lines,
    add: (line) => setLines((prev) => [...prev, { ...line, id: crypto.randomUUID() }]),
    setQuantity: (id, quantity) =>
      setLines((prev) =>
        quantity <= 0
          ? prev.filter((l) => l.id !== id)
          : prev.map((l) => (l.id === id ? { ...l, quantity: Math.min(quantity, MAX_QUANTITY) } : l)),
      ),
    clear: () => setLines([]),
    isOpen,
    open: () => setIsOpen(true),
    close: () => setIsOpen(false),
  };

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useCart() {
  const cart = useContext(Context);
  if (!cart) throw new Error("useCart must be used inside CartProvider");
  return cart;
}

export function CartLink() {
  const { lines, open } = useCart();
  const count = lines.reduce((n, l) => n + l.quantity, 0);
  return (
    <button type="button" onClick={open} className="hover:text-accent">
      Cart{count > 0 && <span className="ml-1 rounded-full bg-accent px-2 py-0.5 text-xs text-accent-contrast">{count}</span>}
    </button>
  );
}

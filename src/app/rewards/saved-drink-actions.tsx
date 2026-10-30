"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { deleteSavedDrink } from "@/app/actions/customer";
import { useCart } from "@/components/cart";
import type { Selection } from "@/lib/drink";

type Props = {
  id: number;
  slug: string;
  drinkName: string;
  summary: string;
  selection: Selection;
  priceCents: number | null;
};

export function SavedDrinkActions({ id, slug, drinkName, summary, selection, priceCents }: Props) {
  const cart = useCart();
  const [added, setAdded] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <div className="mt-3 flex flex-wrap items-center gap-4 text-sm font-medium">
      {priceCents !== null && (
        <button
          type="button"
          onClick={() => {
            cart.add({ slug, drinkName, summary, selection, unitPriceCents: priceCents, quantity: 1 });
            setAdded(true);
          }}
          className="rounded-full bg-accent px-4 py-1.5 text-accent-contrast hover:opacity-90"
        >
          {added ? "Added ✓" : "Add to order"}
        </button>
      )}
      <Link href={`/menu/${slug}#s=${encodeURIComponent(JSON.stringify(selection))}`} className="hover:text-accent">
        Edit
      </Link>
      {priceCents !== null && (
        <Link href={`/saved/${id}/publish`} className="text-accent hover:underline">
          Publish
        </Link>
      )}
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (confirm("Delete this saved drink?")) startTransition(async () => void (await deleteSavedDrink(id)));
        }}
        className="text-muted hover:text-red-600"
      >
        Delete
      </button>
    </div>
  );
}

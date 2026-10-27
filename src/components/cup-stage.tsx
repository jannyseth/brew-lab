"use client";

import { useState } from "react";
import type { CupVisual } from "@/lib/cup-visual";
import type { Nutrients } from "@/lib/nutrition";
import { CupArt } from "./cup-art";

/** The live cup. Tap it to flip to nutrition facts; tap again to flip back. */
export function CupStage({ visual, nutrition, title }: { visual: CupVisual; nutrition: Nutrients; title: string }) {
  const [flipped, setFlipped] = useState(false);
  return (
    <button
      type="button"
      onClick={() => setFlipped(!flipped)}
      aria-pressed={flipped}
      aria-label={flipped ? "Show the cup" : "Show nutrition facts"}
      className="group relative mx-auto block aspect-[3/4] h-full max-h-full w-auto max-w-full cursor-pointer [perspective:1200px] focus-visible:outline-none"
    >
      <span
        className="relative block h-full w-full transition-transform duration-700 [transform-style:preserve-3d]"
        style={{ transform: flipped ? "rotateY(180deg)" : "none" }}
      >
        <span className="absolute inset-0 flex flex-col items-center justify-center [backface-visibility:hidden]">
          <CupArt visual={visual} animate className="h-full w-full drop-shadow-sm" />
          <span className="absolute right-1 top-1 whitespace-nowrap rounded-full bg-card/90 px-3 py-1 text-[11px] text-muted shadow-sm ring-1 ring-line sm:text-xs group-hover:text-accent group-focus-visible:ring-2 group-focus-visible:ring-accent">
            Tap for nutrition
          </span>
        </span>
        <span className="absolute inset-0 flex items-center justify-center [backface-visibility:hidden] [transform:rotateY(180deg)]">
          <NutritionLabel nutrition={nutrition} title={title} />
        </span>
      </span>
    </button>
  );
}

function NutritionLabel({ nutrition, title }: { nutrition: Nutrients; title: string }) {
  const rows: [string, string, boolean?][] = [
    ["Total sugars", `${nutrition.sugar} g`],
    ["Total fat", `${nutrition.fat} g`],
    ["Protein", `${nutrition.protein} g`],
    ["Caffeine", `${nutrition.caffeine} mg`, true],
  ];
  return (
    <span className="block w-full max-w-[260px] rounded-xl border-2 border-foreground bg-card p-4 text-left text-foreground shadow-lg">
      <span className="block font-display text-2xl font-bold leading-none">Nutrition Facts</span>
      <span className="mt-1 block truncate text-xs text-muted">{title}</span>
      <span className="mt-2 block border-t-8 border-foreground pt-1 text-xs font-semibold">Estimated per cup</span>
      <span className="mt-1 flex items-baseline justify-between border-b-4 border-foreground pb-1">
        <span className="text-lg font-bold">Calories</span>
        <span className="font-display text-4xl font-bold tabular-nums">{nutrition.calories}</span>
      </span>
      {rows.map(([label, value, strong]) => (
        <span key={label} className={`flex justify-between border-b border-line py-1 text-sm ${strong ? "font-semibold" : ""}`}>
          <span>{label}</span>
          <span className="tabular-nums">{value}</span>
        </span>
      ))}
      <span className="mt-2 block text-[10px] leading-tight text-muted">
        Estimates from typical ingredient values; actual amounts vary. Tap to see your cup again.
      </span>
    </span>
  );
}

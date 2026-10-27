"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { CupVisual } from "@/lib/cup-visual";

// The drink illustration: a glass mug for hot drinks, a clear tumbler for iced.
// Layers grow as ingredients are added; with `animate`, each new ingredient
// pours in, ice drops, toppings pop on and hot drinks steam.

const ESPRESSO = { signature: "#3b2214", blonde: "#6b3f1f", decaf: "#4f3020" } as const;
const MILK: Record<string, string> = {
  "whole-milk": "#efe0c8",
  "skim-milk": "#f5ede1",
  "oat-milk": "#e4c99c",
  "almond-milk": "#eddbc0",
  "soy-milk": "#e9d6b2",
};
const SYRUP: Record<string, string> = {
  "vanilla-syrup": "#f1dfa8",
  "caramel-syrup": "#c98a3d",
  "hazelnut-syrup": "#a0683a",
  "mocha-sauce": "#5a3220",
};
const BREWED = "#4a2c1a";
const WATER_COFFEE = "#6b4a33";

type Layer = { id: string; color: string; from: number; to: number };

/** Stacks the liquid layers bottom-up as fractions of the cup's height. */
function layersFor(v: CupVisual): Layer[] {
  const layers: Layer[] = [];
  let level = 0;
  const push = (id: string, color: string, amount: number) => {
    if (amount <= 0) return;
    const to = Math.min(0.92, level + amount);
    layers.push({ id, color, from: level, to });
    level = to;
  };
  if (v.brewed) push("brewed", BREWED, v.milk ? 0.55 : 0.82);
  push("espresso", ESPRESSO[v.roast], v.demitasse ? Math.min(0.75, v.shots * 0.3) : Math.min(0.4, v.shots * 0.075));
  v.syrups.forEach((s) => push(s, SYRUP[s], 0.035));
  if (v.milk) push("milk", MILK[v.milk], 0.86 - level);
  // No milk: an americano-style drink topped up with water (hot or over ice).
  else if (!v.brewed && !v.demitasse && v.shots > 0 && (v.iced || v.size !== "small")) push("water", WATER_COFFEE, 0.8 - level);
  if (v.foam) push("foam", "#fbf1e3", 0.08);
  else if (v.milk && !v.iced) push("microfoam", "#f8eedf", 0.05);
  return layers;
}

const SCALE = { small: 0.8, medium: 0.9, large: 1 } as const;
const DEMITASSE_SCALE = 0.62;

export function CupArt({ visual, animate = false, className }: { visual: CupVisual; animate?: boolean; className?: string }) {
  const layers = layersFor(visual);
  const top = layers.at(-1)?.to ?? 0;
  const [pour, setPour] = useState<{ color: string; key: number } | null>(null);
  const previous = useRef(layers);
  const pourCount = useRef(0);
  // Unique SVG ids so many cups can share a page.
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");

  // When a layer appears or grows, pour that ingredient in from above.
  useEffect(() => {
    if (!animate) return;
    const before = new Map(previous.current.map((l) => [l.id, l.to - l.from]));
    previous.current = layers;
    const grown = layers.find((l) => (before.get(l.id) ?? 0) + 0.001 < l.to - l.from);
    if (!grown) return;
    pourCount.current += 1;
    setPour({ color: grown.color, key: pourCount.current });
    const timer = setTimeout(() => setPour(null), 900);
    return () => clearTimeout(timer);
    // The layers are derived from `visual`, so watching it is enough.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visual, animate]);

  // Cup geometry in a 240 x 320 view box.
  const iced = visual.iced;
  const rimY = iced ? 46 : 92;
  const bottomY = 298;
  const outer = iced ? "M48 46 L192 46 L172 298 L68 298 Z" : "M44 92 L176 92 L168 290 Q166 298 156 298 L64 298 Q54 298 52 290 Z";
  const inner = iced ? "M54 52 L186 52 L167 292 L73 292 Z" : "M50 98 L170 98 L162 287 Q160 292 152 292 L68 292 Q60 292 58 287 Z";
  const innerTop = rimY + 6;
  const innerBottom = bottomY - 6;
  const height = innerBottom - innerTop;
  const y = (fraction: number) => innerBottom - fraction * height;
  const surfaceY = y(top);
  const iceCount = visual.ice === "light" ? 3 : visual.ice === "extra" ? 8 : visual.ice ? 5 : 0;
  const anim = (name: string) => (animate ? name : "");

  return (
    <svg viewBox="0 0 240 320" className={className} aria-hidden>
      <defs>
        <clipPath id={`cup-liquid-${uid}`}>
          <path d={inner} />
        </clipPath>
        <linearGradient id={`glass-shine-${uid}`} x1="0" x2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.55" />
          <stop offset="0.25" stopColor="#ffffff" stopOpacity="0.08" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>

      <g
        style={{
          transform: `scale(${visual.demitasse ? DEMITASSE_SCALE : SCALE[visual.size]})`,
          transformOrigin: "120px 300px",
          transition: "transform 450ms cubic-bezier(.2,.8,.2,1)",
        }}
      >
        {/* Steam for hot drinks */}
        {!iced && top > 0.1 &&
          [70, 110, 150].map((x, i) => (
            <path
              key={x}
              d={`M${x} 80 q -8 -14 0 -28 q 8 -14 0 -28`}
              fill="none"
              stroke="var(--muted)"
              strokeWidth="3"
              strokeLinecap="round"
              opacity="0.35"
              className={anim("cup-steam")}
              style={{ animationDelay: `${i * 0.6}s` }}
            />
          ))}

        {/* Mug handle */}
        {!iced && <path d="M172 130 q 46 4 40 54 q -6 44 -46 44" fill="none" stroke="#d9cbbb" strokeWidth="14" strokeLinecap="round" />}

        {/* Liquid */}
        <g clipPath={`url(#cup-liquid-${uid})`}>
          <rect x="0" y="0" width="240" height="320" fill={iced ? "#dcecf1" : "#ffffff"} opacity={iced ? 0.14 : 0.06} />
          {layers.map((l) => (
            <rect
              key={l.id}
              x="0"
              y="0"
              width="240"
              height="1"
              fill={l.color}
              style={{
                transform: `translateY(${y(l.to)}px) scaleY(${(l.to - l.from) * height})`,
                transition: "transform 650ms cubic-bezier(.2,.8,.2,1), fill 400ms",
              }}
            />
          ))}
          {visual.sweetened &&
            [80, 104, 128, 152].map((x, i) => (
              <circle key={x} cx={x} cy={surfaceY + 10 + (i % 2) * 6} r="1.6" fill="#ffffff" opacity="0.8" />
            ))}
          {/* Ice cubes */}
          {Array.from({ length: iceCount }, (_, i) => {
            const cx = 74 + ((i * 37) % 88);
            const cy = Math.max(innerTop + 14, surfaceY - 4) + (i % 3) * 22 + Math.floor(i / 3) * 10;
            return (
              <g key={`${visual.ice}-${i}`} className={anim("cup-drop")} style={{ animationDelay: `${i * 70}ms` }}>
                <rect
                  x={cx}
                  y={cy}
                  width="26"
                  height="24"
                  rx="5"
                  fill="#ffffff"
                  fillOpacity="0.55"
                  stroke="#9fc5d1"
                  strokeWidth="2"
                  transform={`rotate(${(i * 23) % 40 - 20} ${cx + 13} ${cy + 12})`}
                />
              </g>
            );
          })}
          {/* Pour stream for the ingredient just added */}
          {pour && (
            <rect key={pour.key} x="112" y="0" width="14" height={Math.max(20, surfaceY + 4)} rx="7" fill={pour.color} className="cup-pour" />
          )}
        </g>

        {/* Glass */}
        <path d={outer} fill={`url(#glass-shine-${uid})`} stroke={iced ? "#c9dde3" : "#d9cbbb"} strokeWidth="4" strokeLinejoin="round" />

        {/* Toppings */}
        {visual.cinnamon &&
          [84, 98, 112, 126, 140, 154, 106, 132].map((x, i) => (
            <circle
              key={i}
              cx={x + (visual.whip ? 4 : 0)}
              cy={(visual.whip ? rimY - 34 : Math.min(surfaceY, rimY + 8) - 2) + (i % 3) * 4}
              r="2"
              fill="#8b4b22"
              className={anim("cup-pop")}
            />
          ))}
        {visual.whip && (
          <g className={anim("cup-pop")}>
            <path
              d={`M${iced ? 58 : 54} ${rimY + 4} q 0 -34 32 -38 q 4 -22 30 -22 q 26 0 30 22 q 32 4 32 38 Z`}
              fill="#fffaf2"
              stroke="#eadfcf"
              strokeWidth="2"
            />
            <path d={`M92 ${rimY - 30} q 28 10 56 0`} fill="none" stroke="#eadfcf" strokeWidth="2" />
          </g>
        )}
        {visual.drizzle && (
          <path
            d={
              visual.whip
                ? `M74 ${rimY - 10} l 14 -14 l 14 16 l 14 -22 l 14 22 l 14 -16 l 14 14`
                : `M70 ${surfaceY + 4} l 16 -6 l 16 6 l 16 -6 l 16 6 l 16 -6 l 16 6`
            }
            fill="none"
            stroke="#b8702c"
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="300"
            className={anim("cup-draw")}
          />
        )}

        {/* Straw for iced drinks */}
        {iced && <rect x="146" y="6" width="10" height="150" rx="5" fill="var(--accent)" transform="rotate(14 151 81)" opacity="0.9" />}
      </g>
    </svg>
  );
}

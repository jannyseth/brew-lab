"use client";

import { useEffect, useRef, useState } from "react";
import { formatCents } from "@/lib/drink";

// Small, dependency-free SVG charts. Marks use the validated --chart-* colors;
// all text uses text colors, never the series color. Every chart has a hover
// (or focus) readout, and the trend chart offers a table view.

export type Format = "money" | "count";
const fmt = (value: number, format: Format) => (format === "money" ? formatCents(value) : value.toLocaleString("en-PH"));

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(600);
  useEffect(() => {
    if (!ref.current) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

function niceMax(max: number) {
  if (max <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(max));
  return Math.ceil(max / magnitude) * magnitude;
}

/** Change over time for one measure: an area line with a crosshair readout. */
export function TrendChart({
  data,
  format,
  label,
  height = 220,
}: {
  data: { label: string; value: number }[];
  format: Format;
  label: string;
  height?: number;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const [table, setTable] = useState(false);
  const pad = { top: 12, right: 12, bottom: 28, left: 64 };
  const innerW = Math.max(1, width - pad.left - pad.right);
  const innerH = height - pad.top - pad.bottom;
  const max = niceMax(Math.max(...data.map((d) => d.value), 0));
  const x = (i: number) => pad.left + (data.length <= 1 ? innerW / 2 : (i / (data.length - 1)) * innerW);
  const y = (v: number) => pad.top + innerH - (v / max) * innerH;
  const line = data.map((d, i) => `${i ? "L" : "M"}${x(i)},${y(d.value)}`).join("");
  const area = data.length ? `${line}L${x(data.length - 1)},${y(0)}L${x(0)},${y(0)}Z` : "";
  const ticks = [0, 0.5, 1].map((t) => t * max);
  const labelEvery = Math.max(1, Math.ceil(data.length / Math.max(2, Math.floor(innerW / 70))));
  const active = hover !== null ? data[hover] : null;

  return (
    <figure>
      <div className="mb-2 flex items-center justify-end">
        <button type="button" onClick={() => setTable(!table)} className="text-xs text-muted hover:text-accent">
          {table ? "Show chart" : "Show table"}
        </button>
      </div>
      {table ? (
        <div className="max-h-72 overflow-auto rounded-xl border border-line">
          <table className="w-full text-sm">
            <tbody className="tabular-nums">
              {data.map((d) => (
                <tr key={d.label} className="border-b border-line last:border-0">
                  <td className="px-3 py-1.5">{d.label}</td>
                  <td className="px-3 py-1.5 text-right">{fmt(d.value, format)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div ref={ref} className="relative">
          <svg
            width={width}
            height={height}
            role="img"
            aria-label={label}
            onMouseLeave={() => setHover(null)}
            onMouseMove={(e) => {
              const box = e.currentTarget.getBoundingClientRect();
              const px = e.clientX - box.left - pad.left;
              const i = data.length <= 1 ? 0 : Math.round((px / innerW) * (data.length - 1));
              setHover(Math.min(data.length - 1, Math.max(0, i)));
            }}
          >
            {ticks.map((t) => (
              <g key={t}>
                <line x1={pad.left} x2={width - pad.right} y1={y(t)} y2={y(t)} stroke="var(--chart-grid)" />
                <text x={pad.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="fill-muted text-[11px]">
                  {fmt(t, format)}
                </text>
              </g>
            ))}
            <path d={area} fill="var(--chart-1)" opacity={0.12} />
            <path d={line} fill="none" stroke="var(--chart-1)" strokeWidth={2} strokeLinejoin="round" />
            {data.map((d, i) =>
              i % labelEvery === 0 || i === data.length - 1 ? (
                <text key={d.label} x={x(i)} y={height - 8} textAnchor="middle" className="fill-muted text-[11px]">
                  {d.label}
                </text>
              ) : null,
            )}
            {active && hover !== null && (
              <g>
                <line x1={x(hover)} x2={x(hover)} y1={pad.top} y2={pad.top + innerH} stroke="var(--muted)" strokeDasharray="3 3" />
                <circle cx={x(hover)} cy={y(active.value)} r={5} fill="var(--chart-1)" stroke="var(--card)" strokeWidth={2} />
              </g>
            )}
          </svg>
          {active && hover !== null && (
            <div
              className="pointer-events-none absolute top-0 rounded-lg border border-line bg-card px-3 py-1.5 text-xs shadow-sm"
              style={{ left: Math.min(Math.max(x(hover) - 60, 0), width - 130) }}
            >
              <p className="text-muted">{active.label}</p>
              <p className="font-semibold tabular-nums">{fmt(active.value, format)}</p>
            </div>
          )}
        </div>
      )}
    </figure>
  );
}

/** Ranked magnitudes: horizontal bars with labels and values in text color. */
export function BarList({
  items,
  format,
  detail,
}: {
  items: { label: string; value: number; note?: string }[];
  format: Format;
  detail?: (item: { label: string; value: number; note?: string }) => string;
}) {
  const max = Math.max(...items.map((i) => i.value), 1);
  if (items.length === 0) return <p className="text-sm text-muted">No data yet.</p>;
  return (
    <ul className="space-y-2.5">
      {items.map((item) => (
        <li key={item.label} className="group" title={detail ? detail(item) : `${item.label}: ${fmt(item.value, format)}`}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate">{item.label}</span>
            <span className="shrink-0 tabular-nums text-muted">
              {item.note && <span className="mr-2 text-xs">{item.note}</span>}
              <span className="font-medium text-foreground">{fmt(item.value, format)}</span>
            </span>
          </div>
          <div className="mt-1 h-2 rounded-full bg-chart-grid">
            <div
              className="h-2 rounded-full bg-chart-1 transition-opacity group-hover:opacity-80"
              style={{ width: `${Math.max(2, (item.value / max) * 100)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** A single headline proportion: how far sales are toward the license quota. */
export function QuotaDonut({ salesCents, quotaCents, size = 168 }: { salesCents: number; quotaCents: number; size?: number }) {
  const ratio = Math.min(1, quotaCents ? salesCents / quotaCents : 0);
  const percent = Math.floor(ratio * 100);
  const stroke = 14;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const met = salesCents >= quotaCents;
  return (
    <figure className="flex flex-col items-center" title={`${formatCents(salesCents)} of ${formatCents(quotaCents)}`}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} role="img" aria-label={`${percent}% of the renewal quota reached`} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--chart-grid)" strokeWidth={stroke} />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="var(--chart-1)"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${ratio * circumference} ${circumference}`}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-display text-3xl font-semibold tabular-nums">{percent}%</span>
          <span className="text-xs text-muted">{met ? "quota met" : "of quota"}</span>
        </div>
      </div>
      <figcaption className="mt-3 text-center text-sm">
        <span className="font-semibold tabular-nums">{formatCents(salesCents)}</span>
        <span className="text-muted"> of {formatCents(quotaCents)}</span>
        <span className="block text-xs text-muted">
          {met ? "License will renew" : `${formatCents(quotaCents - salesCents)} to go for renewal`}
        </span>
      </figcaption>
    </figure>
  );
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** When customers order: day of week × hour, one hue from light (few) to dark (many). */
export function ActivityHeatmap({ cells }: { cells: { dow: number; hour: number; orders: number }[] }) {
  const [hover, setHover] = useState<{ dow: number; hour: number; orders: number } | null>(null);
  const grid = new Map(cells.map((c) => [`${c.dow}-${c.hour}`, c.orders]));
  const max = Math.max(...cells.map((c) => c.orders), 1);
  const hours = Array.from({ length: 24 }, (_, h) => h);
  const hourLabel = (h: number) => `${h % 12 || 12}${h < 12 ? "am" : "pm"}`;
  return (
    <figure>
      <div className="overflow-x-auto">
        <div className="inline-grid min-w-full gap-[2px]" style={{ gridTemplateColumns: `36px repeat(24, minmax(14px, 1fr))` }}>
          <span />
          {hours.map((h) => (
            <span key={h} className="text-center text-[10px] text-muted">
              {h % 3 === 0 ? hourLabel(h) : ""}
            </span>
          ))}
          {DAYS.map((day, dow) => (
            <div key={day} className="contents">
              <span className="pr-1 text-right text-[11px] leading-4 text-muted">{day}</span>
              {hours.map((hour) => {
                const orders = grid.get(`${dow}-${hour}`) ?? 0;
                return (
                  <button
                    type="button"
                    key={hour}
                    aria-label={`${day} ${hourLabel(hour)}: ${orders} orders`}
                    onMouseEnter={() => setHover({ dow, hour, orders })}
                    onFocus={() => setHover({ dow, hour, orders })}
                    onMouseLeave={() => setHover(null)}
                    className="h-4 rounded-[3px] outline-offset-1"
                    style={{
                      background: orders ? "var(--chart-2)" : "var(--chart-grid)",
                      opacity: orders ? 0.18 + 0.82 * (orders / max) : 1,
                    }}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <figcaption className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
        <span aria-live="polite">
          {hover ? `${DAYS[hover.dow]} ${hourLabel(hover.hour)}: ${hover.orders} orders` : "Hover a square to see the number of orders."}
        </span>
        <span className="flex items-center gap-1">
          Fewer
          {[0.18, 0.45, 0.72, 1].map((o) => (
            <span key={o} className="h-3 w-3 rounded-[3px]" style={{ background: "var(--chart-2)", opacity: o }} />
          ))}
          More
        </span>
      </figcaption>
    </figure>
  );
}

/** Two parts of one total per period, e.g. Brew Lab's 30% fee and the branches' share. */
export function SplitBars({
  data,
  parts,
}: {
  data: { label: string; a: number; b: number }[];
  parts: [string, string];
}) {
  const max = Math.max(...data.map((d) => d.a + d.b), 1);
  const [hover, setHover] = useState<string | null>(null);
  if (data.length === 0) return <p className="text-sm text-muted">No paid sales yet.</p>;
  return (
    <figure>
      <div className="mb-3 flex gap-4 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-chart-1" /> {parts[0]}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-chart-2" /> {parts[1]}
        </span>
      </div>
      <ul className="space-y-2">
        {data.map((d) => (
          <li
            key={d.label}
            className="grid grid-cols-[64px_1fr_auto] items-center gap-3 text-sm"
            onMouseEnter={() => setHover(d.label)}
            onMouseLeave={() => setHover(null)}
          >
            <span className="text-muted tabular-nums">{d.label}</span>
            <div className="flex h-3 gap-[2px]" style={{ width: `${Math.max(2, ((d.a + d.b) / max) * 100)}%` }}>
              <div className="h-3 rounded-l-full bg-chart-1" style={{ flex: d.a || 0.0001 }} />
              <div className="h-3 rounded-r-full bg-chart-2" style={{ flex: d.b || 0.0001 }} />
            </div>
            <span className="tabular-nums">
              {hover === d.label ? (
                <span className="text-xs">
                  {parts[0]} {formatCents(d.a)} · {parts[1]} {formatCents(d.b)}
                </span>
              ) : (
                <span className="font-medium">{formatCents(d.a)}</span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </figure>
  );
}

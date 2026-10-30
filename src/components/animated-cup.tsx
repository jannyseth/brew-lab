"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  blendColors,
  lerpColor,
  sceneTarget,
  stepDuration,
  stepsBetween,
  DURATION,
  type SceneTarget,
  type Step,
  type ToppingId,
} from "@/lib/cup-scene";

// The Build Your Own cup, animated frame by frame. Every change becomes a
// queue of steps (ice drops, pours, drains, milk mixing, stirring, toppings)
// that play one after another, so nothing ever appears instantly. Each pour
// comes from its own tool (espresso machine, milk pitcher, syrup pump, kettle),
// and the drink keeps moving while idle: a rippling surface, rising bubbles
// and bobbing ice, all done in CSS so idle frames cost React nothing.

type RunStep = Step | { kind: "stir" };
type Source = "machine" | "pitcher" | "pump" | "kettle";

const sourceFor = (id: string): Source => (id === "espresso" ? "machine" : id === "water" ? "kettle" : id.startsWith("milk:") ? "pitcher" : "pump");
/** Where each tool's spout sits; the stream falls from here. */
const SPOUT_Y: Record<Source, number> = { machine: -14, pitcher: -12, pump: -62, kettle: -12 };

type Scene = {
  iced: boolean;
  size: SceneTarget["size"];
  bands: { id: string; color: string; vol: number; mixed: number }[];
  ice: { slot: number; drop: number; leaving: number }[];
  toppings: Record<ToppingId, { p: number; fade: number }>;
  stream: { color: string; source: Source; show: number; head: number; tail: number } | null;
  stir: number | null;
  swirl: number;
  sprinkle: number | null;
  time: number;
};

const emptyScene = (): Scene => ({
  iced: false,
  size: "small",
  bands: [],
  ice: [],
  toppings: { whip: { p: 0, fade: 0 }, foam: { p: 0, fade: 0 }, drizzle: { p: 0, fade: 0 }, cinnamon: { p: 0, fade: 0 } },
  stream: null,
  stir: null,
  swirl: 0,
  sprinkle: null,
  time: 0,
});

const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
const easeOutBack = (t: number) => 1 + 2.2 * (t - 1) ** 3 + 1.2 * (t - 1) ** 2;
const clamp = (t: number) => Math.max(0, Math.min(1, t));
const SCALE = { small: 0.8, medium: 0.9, large: 1 } as const;
/** How strongly each ingredient colours the drink when mixed (espresso is far stronger than milk). */
const TINT: Record<string, number> = { espresso: 6, "mocha-sauce": 3, "hazelnut-syrup": 1.5, "caramel-syrup": 1.5, water: 1.2 };

type Run = { duration: number; begin: () => void; update: (p: number) => void; end: () => void };

/** Plays queued steps with requestAnimationFrame and reports a snapshot of the scene each frame. */
class CupEngine {
  private scene = emptyScene();
  private queue: RunStep[] = [];
  private active: (Run & { start: number }) | null = null;
  private frame: number | null = null;

  constructor(
    private onFrame: (scene: Scene) => void,
    private onBusy: (busy: boolean) => void,
    /** Called when liquid or ice first lands, to bounce the cup. */
    private onImpact: () => void,
  ) {}

  push(steps: RunStep[]) {
    if (steps.length === 0) return;
    this.queue.push(...steps);
    if (this.frame === null) {
      this.onBusy(true);
      this.frame = requestAnimationFrame(this.tick);
    }
  }

  destroy() {
    if (this.frame !== null) cancelAnimationFrame(this.frame);
    this.frame = null;
  }

  private tick = (now: number) => {
    this.scene.time = now;
    if (!this.active) {
      const step = this.queue.shift();
      if (!step) {
        this.frame = null;
        this.onFrame(structuredClone(this.scene));
        this.onBusy(false);
        return;
      }
      const run = this.prepare(step);
      run.begin();
      this.active = { ...run, start: now };
    }
    const a = this.active;
    const p = a.duration <= 0 ? 1 : clamp((now - a.start) / a.duration);
    a.update(p);
    if (p >= 1) {
      a.end();
      this.active = null;
    }
    this.onFrame(structuredClone(this.scene));
    this.frame = requestAnimationFrame(this.tick);
  };

  private prepare(step: RunStep): Run {
    const s = this.scene;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const volume = () => s.bands.reduce((sum, b) => sum + b.vol, 0);
    const noop = () => {};
    const timed = (ms: number) => (reduce ? 0 : ms);
    switch (step.kind) {
      case "cup":
        return { duration: timed(DURATION.cup), begin: () => Object.assign(s, { iced: step.iced, size: step.size }), update: noop, end: noop };
      case "ice": {
        const from = s.ice.filter((c) => c.leaving === 0).length;
        return {
          duration: timed(stepDuration(step, { vol: 0, ice: from })),
          begin: () => {
            for (let slot = from; slot < step.to; slot++) s.ice.push({ slot, drop: 0, leaving: 0 });
          },
          update: (p) => {
            const elapsed = p * stepDuration(step, { vol: 0, ice: from });
            for (const c of s.ice) {
              if (c.slot >= step.to) c.leaving = p;
              else if (c.slot >= from) c.drop = clamp((elapsed - (c.slot - from) * DURATION.icePerCube) / DURATION.iceSettle);
            }
          },
          end: () => {
            s.ice = s.ice.filter((c) => c.slot < step.to).map((c) => ({ ...c, drop: 1, leaving: 0 }));
            if (step.to > from) this.onImpact();
          },
        };
      }
      case "pour": {
        let band = s.bands.find((b) => b.id === step.id);
        const from = band?.vol ?? 0;
        const source = sourceFor(step.id);
        let landed = false;
        return {
          duration: timed(stepDuration(step, { vol: from, ice: 0 })),
          begin: () => {
            if (!band) {
              band = { id: step.id, color: step.color, vol: 0, mixed: 0 };
              s.bands.push(band);
            }
          },
          // The tool slides in, the stream falls and fills, then the tool leaves.
          update: (p) => {
            const head = clamp((p - 0.12) / 0.14);
            band!.vol = from + (step.to - from) * ease(clamp((p - 0.22) / 0.66));
            s.stream = { color: step.color, source, show: clamp(p / 0.12) * (1 - clamp((p - 0.92) / 0.08)), head, tail: clamp((p - 0.84) / 0.1) };
            if (!landed && head >= 1) {
              landed = true;
              this.onImpact();
            }
          },
          end: () => {
            band!.vol = step.to;
            s.stream = null;
          },
        };
      }
      case "drain": {
        const band = s.bands.find((b) => b.id === step.id);
        const from = band?.vol ?? 0;
        return {
          duration: timed(DURATION.drain),
          begin: noop,
          update: (p) => {
            if (band) band.vol = from + (step.to - from) * ease(p);
          },
          end: () => {
            if (step.to <= 0) s.bands = s.bands.filter((b) => b.id !== step.id);
            else if (band) band.vol = step.to;
          },
        };
      }
      case "mix":
      case "stir": {
        const stir = step.kind === "stir";
        if (stir && volume() < 0.05) return { duration: 0, begin: noop, update: noop, end: noop };
        const start = s.bands.map((b) => b.mixed);
        return {
          duration: timed(stir ? DURATION.stir : step.duration),
          begin: noop,
          update: (p) => {
            s.bands.forEach((b, i) => (b.mixed = (start[i] ?? 0) + (1 - (start[i] ?? 0)) * ease(p)));
            s.swirl = Math.sin(Math.PI * p);
            if (stir) s.stir = p;
          },
          end: () => {
            s.bands.forEach((b) => (b.mixed = 1));
            s.swirl = 0;
            s.stir = null;
          },
        };
      }
      case "sprinkle":
        return {
          duration: timed(DURATION.sprinkle),
          begin: noop,
          update: (p) => (s.sprinkle = p),
          end: () => (s.sprinkle = null),
        };
      case "topping": {
        const t = s.toppings[step.id];
        return {
          duration: timed(stepDuration(step, { vol: 0, ice: 0 })),
          begin: () => {
            if (step.on) Object.assign(t, { p: 0, fade: 1 });
          },
          update: (p) => {
            if (step.on) t.p = p;
            else t.fade = 1 - p;
          },
          end: () => Object.assign(t, step.on ? { p: 1, fade: 1 } : { p: 0, fade: 0 }),
        };
      }
    }
  }
}

export function AnimatedCup({
  target,
  stirKey,
  covered,
  onBusyChange,
  className,
}: {
  target: SceneTarget;
  /** Changes whenever the customer moves to another station: the drink gets stirred. */
  stirKey: number;
  covered: boolean;
  onBusyChange?: (busy: boolean) => void;
  className?: string;
}) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const [s, setScene] = useState<Scene>(emptyScene);
  const [busy, setBusy] = useState(false);
  const engine = useRef<CupEngine | null>(null);
  const last = useRef<SceneTarget>(sceneTarget({}));
  const firstStir = useRef(stirKey);
  const busyCallback = useRef(onBusyChange);
  const bounce = useRef<SVGGElement>(null);
  useEffect(() => {
    busyCallback.current = onBusyChange;
  }, [onBusyChange]);

  useEffect(() => {
    const e = new CupEngine(
      setScene,
      (b) => {
        setBusy(b);
        busyCallback.current?.(b);
      },
      () => {
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
        // A little squash and stretch, like a cartoon cup taking the hit.
        bounce.current?.animate(
          [{ transform: "scale(1, 1)" }, { transform: "scale(1.05, 0.95)" }, { transform: "scale(0.98, 1.03)" }, { transform: "scale(1, 1)" }],
          { duration: 420, easing: "ease-out" },
        );
      },
    );
    engine.current = e;
    return () => e.destroy();
  }, []);

  // Queue the steps for each change of the drink.
  const key = JSON.stringify(target);
  useEffect(() => {
    engine.current?.push(stepsBetween(last.current, target));
    last.current = target;
    // `key` captures every field of `target`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // Stir whenever the station changes (not on first render).
  useEffect(() => {
    if (stirKey !== firstStir.current) engine.current?.push([{ kind: "stir" }]);
  }, [stirKey]);

  // ---- Drawing (240 x 320 view box) ----
  const iced = s.iced;
  const rimY = iced ? 46 : 92;
  const outer = iced ? "M48 46 L192 46 L172 298 L68 298 Z" : "M44 92 L176 92 L168 290 Q166 298 156 298 L64 298 Q54 298 52 290 Z";
  const inner = iced ? "M54 52 L186 52 L167 292 L73 292 Z" : "M50 98 L170 98 L162 287 Q160 292 152 292 L68 292 Q60 292 58 287 Z";
  const innerTop = rimY + 6;
  const innerBottom = 292;
  const height = innerBottom - innerTop;
  const y = (fraction: number) => innerBottom - fraction * height;
  const volume = s.bands.reduce((sum, b) => sum + b.vol, 0);
  const surfaceY = y(Math.min(0.92, volume));
  const blended = blendColors(s.bands.map((b) => ({ color: b.color, weight: b.vol * (TINT[b.id] ?? 1) })));
  const lidded = covered && !busy;
  const hideToppings = lidded && !iced;

  // Stack the layers bottom-up.
  const bandRects: { id: string; y: number; h: number; color: string }[] = [];
  for (let i = 0, level = 0; i < s.bands.length; i++) {
    const b = s.bands[i];
    const from = Math.min(0.92, level);
    level += b.vol;
    const to = Math.min(0.92, level);
    bandRects.push({ id: b.id, y: y(to), h: (to - from) * height, color: lerpColor(b.color, blended, b.mixed) });
  }

  // Ice settles in a stack at the bottom of the cup.
  const cubeSpot = (slot: number) => {
    const row = Math.floor(slot / 3);
    return { x: [86, 111, 136][slot % 3] + (row % 2) * 7, y: innerBottom - 26 - row * 24, tilt: ((slot * 37) % 30) - 15 };
  };
  const whipTop = rimY - 34;
  const anchorY = s.toppings.whip.fade > 0 ? whipTop : Math.min(surfaceY, rimY + 10) - 2;
  const wobble = Math.sin(s.time / 90);
  const topColor = bandRects.at(-1)?.color;
  // Calm ripples while idle, choppier while pouring or stirring.
  const waveAmp = s.stream || s.stir !== null || s.swirl > 0.02 ? 10 : 5;
  const crests = Array.from({ length: 9 }, () => "t20 0").join(" ");
  const wave = `M-40 ${surfaceY} q10 -${waveAmp} 20 0 ${crests}`;
  const spoutY = s.stream ? SPOUT_Y[s.stream.source] : 0;

  return (
    <svg viewBox="0 -80 240 400" className={className} aria-hidden>
      <defs>
        <clipPath id={`liquid-${uid}`}>
          <path d={inner} />
        </clipPath>
        <linearGradient id={`shine-${uid}`} x1="0" x2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.55" />
          <stop offset="0.25" stopColor="#ffffff" stopOpacity="0.08" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>

      <g style={{ transform: `scale(${SCALE[s.size]})`, transformOrigin: "120px 300px", transition: "transform 400ms cubic-bezier(.2,.8,.2,1)" }}>
        {s.stream && <PourTool source={s.stream.source} color={s.stream.color} show={s.stream.show} time={s.time} />}
        <g ref={bounce} style={{ transformOrigin: "120px 298px" }}>
        {/* Steam */}
        {!iced && volume > 0.1 && !lidded &&
          [72, 110, 148].map((x, i) => (
            <path
              key={x}
              d={`M${x} 82 q -8 -14 0 -28 q 8 -14 0 -28`}
              fill="none"
              stroke="var(--muted)"
              strokeWidth="3"
              strokeLinecap="round"
              opacity="0.35"
              className="cup-steam"
              style={{ animationDelay: `${i * 0.6}s` }}
            />
          ))}
        {!iced && !lidded && <path d="M172 130 q 46 4 40 54 q -6 44 -46 44" fill="none" stroke="#d9cbbb" strokeWidth="14" strokeLinecap="round" />}

        <g clipPath={`url(#liquid-${uid})`}>
          <rect width="240" height="320" fill={iced ? "#dcecf1" : "#ffffff"} opacity={iced ? 0.14 : 0.06} />

          {/* Ice, behind the liquid so it shows through */}
          {s.ice.map((c) => {
            const spot = cubeSpot(c.slot);
            const fallFrom = -60;
            const yNow = c.leaving > 0 ? spot.y - c.leaving * 30 : fallFrom + (spot.y - fallFrom) * easeOutBack(c.drop);
            const settled = c.drop >= 1 && c.leaving === 0;
            return (
              <g key={c.slot} className={settled ? "ice-bob" : undefined} style={{ animationDelay: `${(c.slot % 4) * -0.6}s` }}>
              <rect
                x={spot.x}
                y={yNow}
                width="24"
                height="22"
                rx="5"
                fill="#ffffff"
                fillOpacity="0.6"
                stroke="#9fc5d1"
                strokeWidth="2"
                opacity={1 - c.leaving}
                transform={`rotate(${spot.tilt * c.drop} ${spot.x + 12} ${yNow + 11})`}
              />
              </g>
            );
          })}

          {/* Liquid layers */}
          <g opacity={iced ? 0.88 : 1}>
            {bandRects.map((b) => (
              <rect key={b.id} x="0" y={b.y} width="240" height={Math.max(0, b.h) + 0.5} fill={b.color} />
            ))}
          </g>
          {/* Bubbles rising through the drink */}
          {volume > 0.15 &&
            !lidded &&
            [70, 96, 118, 142, 162, 108].map((x, i) => (
              <circle
                key={i}
                cx={x}
                cy={innerBottom - 8}
                r={1.6 + (i % 3) * 0.9}
                fill="#ffffff"
                className="cup-bubble"
                style={
                  {
                    "--rise": `${surfaceY - innerBottom + 14}px`,
                    animationDelay: `${i * 0.55}s`,
                    animationDuration: `${2.4 + (i % 3) * 0.8}s`,
                  } as React.CSSProperties
                }
              />
            ))}

          {/* The rippling surface */}
          {volume > 0.02 && topColor && (
            <g className="liquid-wave" opacity={iced ? 0.88 : 1}>
              <path d={`${wave} V${surfaceY + 8} H-40 Z`} fill={topColor} />
              <path d={wave} fill="none" stroke="#ffffff" strokeWidth="2" opacity="0.3" />
            </g>
          )}

          {/* Marbling while milk mixes or the drink is stirred */}
          {s.swirl > 0.02 &&
            [0.25, 0.5, 0.75].map((f, i) => {
              const yy = surfaceY + (innerBottom - surfaceY) * f;
              const phase = s.time / 180 + i * 2;
              const d = `M40 ${yy} ${Array.from({ length: 8 }, (_, k) => `Q ${55 + k * 20} ${yy + Math.sin(phase + k) * 9} ${65 + k * 20} ${yy}`).join(" ")}`;
              return <path key={f} d={d} fill="none" stroke="#fff6ea" strokeWidth="5" strokeLinecap="round" opacity={s.swirl * 0.45} />;
            })}

          {/* Pour stream and splash */}
          {s.stream && (
            <>
              <rect
                x={117 + wobble}
                y={spoutY + s.stream.tail * (surfaceY - spoutY)}
                width={(s.stream.source === "pump" ? 6 : 9) - s.stream.tail * 4}
                height={Math.max(0, (surfaceY - spoutY) * (s.stream.head - s.stream.tail))}
                rx="4.5"
                fill={s.stream.color}
              />
              {s.stream.head >= 1 && s.stream.tail < 1 && (
                <>
                  <ellipse cx="121" cy={surfaceY} rx={12 + 4 * Math.abs(wobble)} ry="3" fill={s.stream.color} opacity="0.7" />
                  {/* Splash droplets */}
                  {[0, 1, 2, 3, 4, 5].map((i) => {
                    const f = (s.time / 420 + i / 6) % 1;
                    const dir = i % 2 ? 1 : -1;
                    return (
                      <circle
                        key={i}
                        cx={121 + dir * (6 + f * (16 + (i % 3) * 6))}
                        cy={surfaceY - Math.sin(f * Math.PI) * (10 + (i % 3) * 5)}
                        r={2.4 * (1 - f) + 0.4}
                        fill={s.stream!.color}
                      />
                    );
                  })}
                </>
              )}
            </>
          )}

          {/* Sweetener dissolving */}
          {s.sprinkle !== null &&
            [92, 104, 116, 128, 140, 152].map((x, i) => {
              const f = clamp(s.sprinkle! * 1.4 - i * 0.07);
              return <circle key={x} cx={x} cy={-5 + (surfaceY + 10) * f} r="2.2" fill="#ffffff" opacity={1 - clamp((s.sprinkle! - 0.75) / 0.25)} />;
            })}

          {/* Cold foam spreads across the surface */}
          {!hideToppings && s.toppings.foam.fade > 0 && (
            <rect
              x={120 - 62 * s.toppings.foam.p}
              y={surfaceY - 10}
              width={124 * s.toppings.foam.p}
              height="12"
              rx="6"
              fill="#fbf1e3"
              opacity={s.toppings.foam.fade}
            />
          )}

        </g>

        {/* Glass */}
        <path d={outer} fill={`url(#shine-${uid})`} stroke={iced ? "#c9dde3" : "#d9cbbb"} strokeWidth="4" strokeLinejoin="round" />

        {/* Spoon stirring */}
          {s.stir !== null && (() => {
            const p = s.stir;
            const dip = p < 0.2 ? p / 0.2 : p > 0.85 ? 1 - (p - 0.85) / 0.15 : 1;
            const q = clamp((p - 0.2) / 0.65);
            const tipX = 120 + 34 * Math.sin(q * Math.PI * 4);
            const tipY = Math.min(innerBottom - 20, surfaceY + 40) - (1 - dip) * 220;
            return (
              <g opacity="0.95">
                <line x1={tipX} y1={tipY} x2={tipX + 40} y2={tipY - 210} stroke="#9d958a" strokeWidth="8" strokeLinecap="round" />
                <ellipse cx={tipX} cy={tipY} rx="13" ry="8" fill="#b9b2a8" stroke="#9d958a" strokeWidth="2" />
              </g>
            );
          })()}

        {/* Fresh cold foam pour from above */}
        {!hideToppings && s.toppings.foam.fade > 0 && s.toppings.foam.p < 0.45 && (
          <rect x="114" y="0" width="12" height={surfaceY - 6} rx="6" fill="#fbf1e3" opacity={1 - s.toppings.foam.p * 2} />
        )}

        {/* Whipped cream piped in tiers, with the nozzle rising */}
        {!hideToppings && s.toppings.whip.fade > 0 && (
          <g opacity={s.toppings.whip.fade}>
            {[0, 1, 2].map((tier) => {
              const t = easeOutBack(clamp(s.toppings.whip.p * 3 - tier));
              return t > 0 ? (
                <ellipse
                  key={tier}
                  cx="120"
                  cy={rimY - 2 - tier * 15}
                  rx={(64 - tier * 19) * t}
                  ry={15 * t}
                  fill="#fffaf2"
                  stroke="#eadfcf"
                  strokeWidth="2"
                />
              ) : null;
            })}
            {s.toppings.whip.p >= 0.95 && <path d={`M114 ${rimY - 40} q 6 -12 12 0`} fill="#fffaf2" stroke="#eadfcf" strokeWidth="2" />}
            {s.toppings.whip.p < 1 && (
              <path
                d={`M108 ${rimY - 70 - Math.min(2, s.toppings.whip.p * 3) * 15} h24 l-8 22 h-8 z`}
                fill="#c7c0b8"
                stroke="#a9a196"
                strokeWidth="1.5"
              />
            )}
          </g>
        )}

        {/* Caramel drizzle drawn by a tilted bottle */}
        {!hideToppings && s.toppings.drizzle.fade > 0 && (
          <g opacity={s.toppings.drizzle.fade}>
            <path
              d={`M72 ${anchorY + 2} l 14 -12 l 14 14 l 14 -14 l 14 14 l 14 -14 l 14 12`}
              fill="none"
              stroke="#b8702c"
              strokeWidth="5"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="200"
              strokeDashoffset={200 * (1 - s.toppings.drizzle.p)}
            />
            {s.toppings.drizzle.p < 1 && (
              <g transform={`translate(${72 + 96 * s.toppings.drizzle.p} ${anchorY - 30}) rotate(150)`}>
                <rect x="-9" y="-6" width="18" height="34" rx="5" fill="#c98a3d" stroke="#8a5a28" strokeWidth="1.5" />
                <rect x="-3" y="-14" width="6" height="9" rx="2" fill="#8a5a28" />
              </g>
            )}
          </g>
        )}

        {/* Cinnamon shaken from a shaker */}
        {!hideToppings && s.toppings.cinnamon.fade > 0 && (
          <g opacity={s.toppings.cinnamon.fade}>
            {Array.from({ length: 10 }, (_, i) => {
              const f = clamp((s.toppings.cinnamon.p - i * 0.04) / 0.45);
              if (f <= 0) return null;
              const x = 92 + i * 6 + (i % 2) * 3;
              const landY = anchorY + (s.toppings.whip.fade > 0 ? 6 : 0) + (i % 3) * 3;
              const startY = anchorY - 52;
              return <circle key={i} cx={x} cy={startY + (landY - startY) * f} r="2" fill="#8b4b22" />;
            })}
            {s.toppings.cinnamon.p < 0.85 && (
              <g transform={`translate(150 ${anchorY - 78}) rotate(${160 + Math.sin(s.toppings.cinnamon.p * Math.PI * 6) * 16})`}>
                <rect x="-11" y="-16" width="22" height="30" rx="5" fill="#e8ddd0" stroke="#a9a196" strokeWidth="1.5" />
                <rect x="-12" y="12" width="24" height="7" rx="2" fill="#8b4b22" />
              </g>
            )}
          </g>
        )}

        {/* Lids, once everything has settled */}
        {lidded && !iced && (
          <g className="cup-pop">
            <path d={outer} fill="#fbf6ef" stroke="#d9cbbb" strokeWidth="4" strokeLinejoin="round" />
            <path d="M47 160 L173 160 L169 228 L51 228 Z" fill="var(--accent)" />
            <text x="110" y="200" textAnchor="middle" fontSize="20" fontWeight="700" fill="#ffffff" fontFamily="var(--font-fraunces), serif">
              Brew Lab
            </text>
            <rect x="36" y={rimY - 16} width="148" height="18" rx="7" fill="#3b2a20" />
            <path d={`M52 ${rimY - 16} q 58 -22 116 0 Z`} fill="#4a372b" />
            <rect x="122" y={rimY - 24} width="22" height="6" rx="3" fill="#2a1d15" />
          </g>
        )}
        {lidded && iced && (
          <g className="cup-pop">
            <path
              d={`M42 ${rimY} q 78 -${s.toppings.whip.fade > 0 ? 92 : 60} 156 0 Z`}
              fill="#ffffff"
              fillOpacity="0.3"
              stroke="#b9d3db"
              strokeWidth="3"
            />
            <rect x="38" y={rimY - 4} width="164" height="10" rx="5" fill="#d7e8ee" stroke="#b9d3db" strokeWidth="2" />
          </g>
        )}
        {iced && <rect x="146" y="6" width="10" height="150" rx="5" fill="var(--accent)" transform="rotate(14 151 81)" opacity="0.9" />}
        </g>
      </g>
    </svg>
  );
}

/** The tool doing the pour, sliding down from above the cup. Its spout sits over the cup's centre. */
function PourTool({ source, color, show, time }: { source: Source; color: string; show: number; time: number }) {
  const t = ease(show);
  const style = { opacity: t, transform: `translateY(${(t - 1) * 60}px)` };
  switch (source) {
    case "machine":
      return (
        <g style={style}>
          <rect x="70" y="-80" width="102" height="44" rx="8" fill="#5a4a40" />
          <rect x="70" y="-80" width="102" height="10" rx="5" fill="#6d5b4f" />
          <circle cx="152" cy="-58" r="6" fill={Math.sin(time / 200) > 0 ? "#f0a35e" : "#8a6a52"} />
          <rect x="94" y="-36" width="54" height="14" rx="5" fill="#2f2620" />
          <rect x="146" y="-33" width="44" height="7" rx="3.5" fill="#2f2620" />
          <rect x="112" y="-23" width="5" height="10" rx="2" fill="#2f2620" />
          <rect x="125" y="-23" width="5" height="10" rx="2" fill="#2f2620" />
        </g>
      );
    case "pitcher": {
      const rock = Math.sin(time / 260) * 3;
      return (
        <g style={style}>
          <g transform={`rotate(${-68 + rock} 121 -12)`}>
            <path d="M121 -12 L156 -12 L160 34 Q160 40 154 40 L128 40 Q122 40 122 34 Z" fill="#dfe4e8" stroke="#9aa3ab" strokeWidth="2" />
            <path d="M121 -12 L156 -12 L157 0 L121 0 Z" fill={color} />
            <path d="M158 -2 q 18 4 15 22 q -2 12 -13 14" fill="none" stroke="#9aa3ab" strokeWidth="5" strokeLinecap="round" />
          </g>
        </g>
      );
    }
    case "pump": {
      // The pump head presses down in quick strokes.
      const press = Math.abs(Math.sin(time / 130)) * 6;
      return (
        <g style={style}>
          <rect x="134" y="-40" width="36" height="70" rx="9" fill={color} stroke="#00000033" strokeWidth="2" />
          <rect x="138" y="-14" width="28" height="22" rx="4" fill="#ffffff" opacity="0.75" />
          <rect x="146" y="-52" width="12" height="13" rx="2" fill="#2f2620" />
          <g transform={`translate(0 ${press})`}>
            <rect x="149" y="-76" width="6" height="26" fill="#3d322b" />
            <rect x="116" y="-80" width="44" height="9" rx="4" fill="#2f2620" />
            <rect x="116" y="-74" width="9" height="12" rx="2" fill="#2f2620" />
          </g>
        </g>
      );
    }
    case "kettle":
      return (
        <g style={style}>
          <path d="M121 -12 C 128 -40 146 -36 156 -30" fill="none" stroke="#3d3d3d" strokeWidth="6" strokeLinecap="round" />
          <ellipse cx="182" cy="-30" rx="28" ry="22" fill="#4a4a4a" />
          <rect x="176" y="-56" width="12" height="6" rx="3" fill="#2e2e2e" />
          <path d="M200 -46 q 20 6 14 30" fill="none" stroke="#2e2e2e" strokeWidth="5" strokeLinecap="round" />
        </g>
      );
  }
}

"use client";

import QRCode from "qrcode";
import { useEffect, useRef, useState } from "react";
import { counterClock } from "@/app/actions/lounge";

type Clock = NonNullable<Awaited<ReturnType<typeof counterClock>>>;

/**
 * The QR code for the counter screen. It changes every minute, so a worker
 * has to be at the shop to scan it; a photo of it stops working quickly.
 */
export function CounterClock({ branchId }: { branchId: number }) {
  const [clock, setClock] = useState<Clock | null>(null);
  const [qr, setQr] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const [error, setError] = useState("");
  const box = useRef<HTMLDivElement>(null);

  // Fetch the code (and who's on the clock) now, at every change of minute, and every 15 s.
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    async function load() {
      try {
        const next = await counterClock(branchId);
        if (cancelled) return;
        if (!next) return setError("You don't have access to this branch's clock.");
        setError("");
        setClock(next);
        const url = `${window.location.origin}/clock/${branchId}?c=${next.code}`;
        setQr(await QRCode.toDataURL(url, { margin: 1, width: 480 }));
        timer = setTimeout(load, Math.min(15_000, Math.max(500, next.expiresAt - Date.now() + 300)));
      } catch {
        if (!cancelled) setError("Can't reach Brew Lab. Retrying…");
        timer = setTimeout(load, 5_000);
      }
    }
    void load();
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      clearInterval(tick);
    };
  }, [branchId]);

  const left = clock ? Math.max(0, Math.ceil((clock.expiresAt - now) / 1000)) : 0;
  const time = (iso: string) =>
    new Intl.DateTimeFormat("en-PH", { timeStyle: "short", timeZone: process.env.NEXT_PUBLIC_TIMEZONE || undefined }).format(new Date(iso));

  return (
    <div ref={box} className="flex flex-col items-center gap-6 rounded-3xl bg-card p-6 text-center ring-1 ring-line md:p-10 [&:fullscreen]:justify-center">
      <div>
        <p className="font-display text-3xl font-semibold">Clock in or out</p>
        <p className="mt-1 text-muted">Open your phone camera and scan this code.</p>
      </div>
      <div className="relative">
        {qr ? (
          // eslint-disable-next-line @next/next/no-img-element -- generated data URL
          <img src={qr} alt="Clock-in QR code" className="h-72 w-72 rounded-2xl bg-white p-3 md:h-96 md:w-96" />
        ) : (
          <div className="h-72 w-72 animate-pulse rounded-2xl bg-line md:h-96 md:w-96" />
        )}
      </div>
      <div className="w-72 md:w-96">
        <div className="h-2 overflow-hidden rounded-full bg-line">
          <div className="h-full rounded-full bg-accent transition-[width] duration-1000 ease-linear" style={{ width: `${(left / 60) * 100}%` }} />
        </div>
        <p className="mt-2 text-sm text-muted tabular-nums">{error || `New code in ${left}s`}</p>
      </div>
      {clock && (
        <div className="w-full max-w-md text-left">
          <p className="text-sm font-semibold">On the clock now · {clock.onClock.length}</p>
          {clock.onClock.length === 0 ? (
            <p className="text-sm text-muted">Nobody yet.</p>
          ) : (
            <ul className="mt-1 text-sm">
              {clock.onClock.map((p) => (
                <li key={p.name} className="flex justify-between border-b border-line py-1.5 last:border-0">
                  <span>{p.name}</span>
                  <span className="text-muted">since {time(p.since)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <button
        type="button"
        onClick={() => (document.fullscreenElement ? document.exitFullscreen() : box.current?.requestFullscreen())}
        className="text-sm font-medium text-accent hover:underline"
      >
        Full screen
      </button>
    </div>
  );
}

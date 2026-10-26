import { formatCents } from "@/lib/drink";

export function QuotaProgress({ salesCents, quotaCents }: { salesCents: number; quotaCents: number }) {
  const percent = Math.min(100, Math.round((salesCents / quotaCents) * 100));
  const met = salesCents >= quotaCents;
  return (
    <div className="mt-2">
      <div className="flex justify-between text-xs">
        <span className="font-medium">
          {formatCents(salesCents)} of {formatCents(quotaCents)}
        </span>
        <span className={met ? "font-medium text-emerald-700 dark:text-emerald-400" : "text-muted"}>
          {met ? "Quota met · renews" : `${percent}% toward renewal`}
        </span>
      </div>
      <div
        className="mt-1 h-2 overflow-hidden rounded-full bg-line"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Sales toward license renewal quota"
      >
        <div className={`h-full rounded-full ${met ? "bg-emerald-600" : "bg-accent"}`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

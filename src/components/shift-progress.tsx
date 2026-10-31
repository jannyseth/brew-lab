/** Orders finished this shift against the branch's target. The target is a goal, never a limit. */
export function ShiftProgress({ done, target }: { done: number; target: number | null }) {
  if (!target) {
    return (
      <p className="text-sm">
        <span className="font-display text-2xl font-semibold tabular-nums">{done}</span> <span className="text-muted">orders this shift</span>
      </p>
    );
  }
  const reached = done >= target;
  return (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        <span>
          <span className="font-display text-2xl font-semibold tabular-nums">{done}</span>
          <span className="text-muted"> / {target} orders this shift</span>
        </span>
        {reached && <span className="font-medium text-emerald-700 dark:text-emerald-300">🎯 Target hit</span>}
      </div>
      <div
        className="mt-1.5 h-2 overflow-hidden rounded-full bg-line"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={target}
        aria-valuenow={Math.min(done, target)}
        aria-label="Shift target"
      >
        <div className={`h-full rounded-full ${reached ? "bg-emerald-500" : "bg-accent"}`} style={{ width: `${Math.min(100, (done / target) * 100)}%` }} />
      </div>
    </div>
  );
}

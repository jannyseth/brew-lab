/** Headline numbers: a row of stat tiles. */
export function StatTiles({ tiles }: { tiles: { label: string; value: string; detail?: string; accent?: boolean }[] }) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {tiles.map((t) => (
        <div
          key={t.label}
          className={`rounded-2xl border p-5 ${t.accent ? "border-accent bg-accent-soft" : "border-line bg-card"}`}
        >
          <p className="text-sm text-muted">{t.label}</p>
          <p className="mt-1 font-display text-2xl font-semibold tabular-nums">{t.value}</p>
          {t.detail && <p className="text-xs text-muted">{t.detail}</p>}
        </div>
      ))}
    </div>
  );
}

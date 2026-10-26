// Shared styling for the account, manager and admin screens.

export const buttonPrimary =
  "rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-accent-contrast hover:opacity-90 disabled:opacity-50";
export const buttonSecondary =
  "rounded-full border border-line px-5 py-2.5 text-sm font-medium hover:border-accent disabled:opacity-50";
export const inputClass =
  "mt-1 w-full rounded-xl border border-line bg-card px-3 py-2 outline-none focus:border-accent focus:ring-2 focus:ring-accent/30";
export const cardClass = "rounded-2xl border border-line bg-card p-5";

export function PageTitle({ title, subtitle }: { title: string; subtitle?: React.ReactNode }) {
  return (
    <div className="mb-8">
      <h1 className="font-display text-4xl font-semibold tracking-tight">{title}</h1>
      {subtitle && <p className="mt-2 text-muted">{subtitle}</p>}
    </div>
  );
}

const badgeColors: Record<string, string> = {
  pending: "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200",
  placed: "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200",
  preparing: "bg-sky-100 text-sky-900 dark:bg-sky-900/40 dark:text-sky-200",
  ready: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200",
  approved: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200",
  completed: "bg-stone-200 text-stone-800 dark:bg-stone-700 dark:text-stone-100",
  paid: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200",
  unpaid: "bg-stone-200 text-stone-800 dark:bg-stone-700 dark:text-stone-100",
  cancelled: "bg-red-100 text-red-900 dark:bg-red-900/40 dark:text-red-200",
  rejected: "bg-red-100 text-red-900 dark:bg-red-900/40 dark:text-red-200",
  expired: "bg-red-100 text-red-900 dark:bg-red-900/40 dark:text-red-200",
  unlicensed: "bg-red-100 text-red-900 dark:bg-red-900/40 dark:text-red-200",
  active: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200",
  renewed: "bg-sky-100 text-sky-900 dark:bg-sky-900/40 dark:text-sky-200",
};

export function Badge({ status }: { status: string }) {
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${badgeColors[status] ?? badgeColors.completed}`}>
      {status}
    </span>
  );
}

export function PageLoading() {
  return <div className="mx-auto max-w-5xl px-4 py-12 text-muted">Loading…</div>;
}

export function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "long",
    timeZone: process.env.NEXT_PUBLIC_TIMEZONE || undefined,
  }).format(date);
}

export function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: process.env.NEXT_PUBLIC_TIMEZONE || undefined,
  }).format(date);
}

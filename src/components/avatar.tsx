/** A round profile picture, or the person's initials when there is none. */
export function Avatar({ src, name, size = 40 }: { src?: string | null; name: string; size?: number }) {
  const initials =
    name
      .split(/[\s@._-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "?";
  return src ? (
    // Images come from our own /api/images route, already resized to a small square.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" width={size} height={size} className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />
  ) : (
    <span
      aria-hidden
      className="flex shrink-0 items-center justify-center rounded-full bg-accent-soft font-semibold text-accent"
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {initials}
    </span>
  );
}

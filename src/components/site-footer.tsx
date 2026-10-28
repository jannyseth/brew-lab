import Link from "next/link";

const socials = [
  {
    label: "Facebook",
    href: "https://www.facebook.com/nadj.vega",
    icon: "M14 8h3V4h-3c-2.8 0-4.5 1.9-4.5 4.6V11H7v4h2.5v9h4v-9H17l.5-4h-4V8.8c0-.5.3-.8.5-.8Z",
  },
  {
    label: "Instagram",
    href: "https://www.instagram.com/jp_vga/",
    icon: "M8 3h8a5 5 0 0 1 5 5v8a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5V8a5 5 0 0 1 5-5Zm0 2a3 3 0 0 0-3 3v8a3 3 0 0 0 3 3h8a3 3 0 0 0 3-3V8a3 3 0 0 0-3-3H8Zm4 3.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7Zm0 2a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3ZM17 6a1 1 0 1 1 0 2 1 1 0 0 1 0-2Z",
  },
  {
    label: "LinkedIn",
    href: "https://www.linkedin.com/in/janseth-joseph-vega-7b43343a5/",
    icon: "M4 9h3.5v11H4V9Zm1.8-5.5a2 2 0 1 1 0 4 2 2 0 0 1 0-4ZM9.5 9H13v1.6c.5-.9 1.7-1.9 3.6-1.9 3.6 0 4.4 2.3 4.4 5.4V20h-3.5v-5.2c0-1.3 0-2.9-1.8-2.9s-2.1 1.4-2.1 2.8V20H9.5V9Z",
  },
];

const legal = [
  { href: "/privacy", label: "Privacy Notice" },
  { href: "/terms", label: "Terms of Use" },
  { href: "/security", label: "Safety & Security" },
  { href: "/credits", label: "Photo credits" },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-line print:hidden">
      <div className="mx-auto grid grid-cols-[minmax(0,1fr)] max-w-5xl gap-8 px-4 py-10 sm:grid-cols-3">
        <div>
          <p className="font-display text-xl font-semibold">Brew Lab</p>
          <p className="mt-2 text-sm text-muted">Made fresh, made yours. Order ahead and pay at pickup.</p>
          <ul className="mt-3 space-y-1 text-sm">
            <li>
              <Link href="/faq" className="text-muted hover:text-accent">
                FAQ &amp; help
              </Link>
            </li>
            <li>
              <Link href="/leaderboard" className="text-muted hover:text-accent">
                Top signature drinks
              </Link>
            </li>
          </ul>
        </div>
        <nav aria-label="Legal" className="text-sm">
          <p className="font-semibold">Your data</p>
          <ul className="mt-2 space-y-1">
            {legal.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="text-muted hover:text-accent">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="text-sm">
          <p className="font-semibold">Follow us</p>
          <ul className="mt-3 flex gap-3">
            {socials.map((s) => (
              <li key={s.label}>
                <a
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Brew Lab on ${s.label}`}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-line text-muted transition hover:border-accent hover:text-accent"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-current">
                    <path d={s.icon} />
                  </svg>
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <p className="border-t border-line px-4 py-4 text-center text-xs text-muted">
        © 2026 Brew Lab · Prices in Philippine pesos · Personal data handled under the Data Privacy Act of 2012 (RA 10173)
      </p>
    </footer>
  );
}

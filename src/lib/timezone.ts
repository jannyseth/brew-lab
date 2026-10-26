import { sql, type AnyColumn } from "drizzle-orm";

// Reports group sales by day in the shop's timezone (set NEXT_PUBLIC_TIMEZONE,
// e.g. "America/New_York"). Defaults to UTC.
function shopTimezone() {
  const tz = process.env.NEXT_PUBLIC_TIMEZONE || "UTC";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
  } catch {
    return "UTC";
  }
  // Safe to inline: validated as a real IANA zone name and limited to these characters.
  return /^[A-Za-z0-9_/+-]+$/.test(tz) ? tz : "UTC";
}

const zone = sql.raw(`'${shopTimezone()}'`);

/** A UTC timestamp column converted to the shop's local time. */
export const localTime = (column: AnyColumn) => sql`((${column} AT TIME ZONE 'UTC') AT TIME ZONE ${zone})`;

/** The current local time in the shop's timezone. */
export const localNow = sql`(now() AT TIME ZONE ${zone})`;

import { nlMonthShort } from "./nl";

/**
 * Parse a `YYYY-MM-DD` string into a local Date at midnight.
 *
 * Using the bare ISO date string with `new Date()` is interpreted as UTC,
 * which then shifts visibly in non-UTC timezones. The `T00:00:00` suffix
 * forces local interpretation.
 */
export function parseLocalDate(iso: string): Date {
  return new Date(`${iso}T00:00:00`);
}

/** Short Dutch date, e.g. `27 apr`. */
export function fmtDateShort(iso: string): string {
  const d = parseLocalDate(iso);
  return `${pad2(d.getDate())} ${nlMonthShort(d.getMonth())}`;
}

/** Full Dutch date, e.g. `27 apr 2026`. */
export function fmtDateFull(iso: string): string {
  const d = parseLocalDate(iso);
  return `${pad2(d.getDate())} ${nlMonthShort(d.getMonth())} ${d.getFullYear()}`;
}

/** Format a Date as `YYYY-MM-DD` in local time (not UTC). */
export function toLocalIsoDate(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

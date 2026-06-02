import { format, parseISO } from "date-fns";
import { nlMonthShort } from "./nl";

/**
 * Parse a `YYYY-MM-DD` string into a local Date at midnight.
 *
 * `parseISO` interprets a date-only string as local midnight (unlike
 * `new Date("YYYY-MM-DD")`, which is UTC and then shifts in non-UTC zones).
 */
export function parseLocalDate(iso: string): Date {
  return parseISO(iso);
}

/**
 * Short Dutch date, e.g. `27 apr`.
 *
 * The numeric parts go through date-fns; the month abbreviation uses our own
 * compact `nlMonthShort` because date-fns' `nl` locale renders abbreviations
 * with a trailing period ("mrt.", "apr."), which we don't want.
 */
export function fmtDateShort(iso: string): string {
  const d = parseLocalDate(iso);
  return `${format(d, "dd")} ${nlMonthShort(d.getMonth())}`;
}

/** Full Dutch date, e.g. `27 apr 2026`. */
export function fmtDateFull(iso: string): string {
  const d = parseLocalDate(iso);
  return `${format(d, "dd")} ${nlMonthShort(d.getMonth())} ${format(d, "yyyy")}`;
}

/** Format a Date as `YYYY-MM-DD` in local time (not UTC). */
export function toLocalIsoDate(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

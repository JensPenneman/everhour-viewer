import Holidays from "date-holidays";
import { toLocalIsoDate } from "@/lib/format";
import type { DayEvent } from "./types";

/**
 * Public-holiday event provider.
 *
 * Backed by the `date-holidays` package. Belgian public holidays in
 * Dutch, requested per-year and cached by year so a typical 78-week
 * window costs at most two `getHolidays(year)` calls.
 *
 * Holidays are categorised by `date-holidays` as `public`, `bank`,
 * `school`, etc.; we only surface the `public` ones — bank/school days
 * aren't days off for everyone.
 */

const CACHE = new Map<string, ReadonlyArray<DayEvent>>();

export interface HolidayProviderOptions {
  /** ISO 3166-1 alpha-2 country code, e.g. `"BE"`. */
  readonly country: string;
  /** Optional region code (e.g. Belgian community). */
  readonly state?: string;
  /** Preferred language for holiday names. */
  readonly language?: string;
}

/**
 * Resolve every public-holiday event in `[from, to]` (inclusive),
 * inputs in `YYYY-MM-DD`.
 */
export function holidaysInRange(
  from: string,
  to: string,
  opts: HolidayProviderOptions,
): ReadonlyArray<DayEvent> {
  const fromDate = new Date(`${from}T00:00:00`);
  const toDate = new Date(`${to}T00:00:00`);
  if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) return [];

  const years = new Set<number>();
  for (let y = fromDate.getFullYear(); y <= toDate.getFullYear(); y++) years.add(y);

  const all: DayEvent[] = [];
  for (const year of years) {
    for (const ev of holidaysForYear(year, opts)) {
      if (ev.date >= from && ev.date <= to) all.push(ev);
    }
  }
  return all;
}

function holidaysForYear(year: number, opts: HolidayProviderOptions): ReadonlyArray<DayEvent> {
  const cacheKey = `${opts.country}|${opts.state ?? ""}|${opts.language ?? "nl"}|${year}`;
  const cached = CACHE.get(cacheKey);
  if (cached) return cached;

  const hd = new Holidays();
  hd.init(opts.country, opts.state, { languages: [opts.language ?? "nl"] });

  const raw = hd.getHolidays(year) ?? [];
  const filtered: DayEvent[] = [];
  for (const h of raw) {
    if (h.type !== "public") continue;
    // `start` is a Date; convert to local YYYY-MM-DD so it matches the
    // way Everhour weeks are keyed.
    const dateIso = toLocalIsoDate(new Date(h.start));
    filtered.push({
      id: `holidays:${opts.country.toLowerCase()}:${dateIso}:${slugify(h.name)}`,
      date: dateIso,
      kind: "holiday",
      source: `holidays:${opts.country.toLowerCase()}`,
      label: h.name,
    });
  }
  CACHE.set(cacheKey, filtered);
  return filtered;
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

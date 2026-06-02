import { addDays as addDaysFns, format, parseISO } from "date-fns";
import type { DayEvent } from "./types";

/**
 * Public-holiday event provider.
 *
 * Belgium's ten statutory public holidays are fully computable — seven are
 * fixed dates and three are Easter-relative — so they're derived here with a
 * tiny computus rather than pulled from a holiday database. That keeps the
 * client bundle ~1.6 MB smaller than bundling `date-holidays`' worldwide
 * dataset for a single country.
 *
 * Only Belgium (`BE`) is supported; other country codes return nothing.
 */

const CACHE = new Map<string, ReadonlyArray<DayEvent>>();

export interface HolidayProviderOptions {
  /** ISO 3166-1 alpha-2 country code. Only `"BE"` is supported. */
  readonly country: string;
  /** Optional region code (unused for Belgium — its holidays are national). */
  readonly state?: string;
  /** Preferred language for holiday names (only `"nl"` is provided). */
  readonly language?: string;
}

/** Dutch names of Belgium's fixed-date public holidays, keyed `MM-DD`. */
const FIXED: ReadonlyArray<readonly [month: number, day: number, name: string]> = [
  [1, 1, "Nieuwjaar"],
  [5, 1, "Dag van de Arbeid"],
  [7, 21, "Nationale feestdag"],
  [8, 15, "Onze-Lieve-Vrouw-Hemelvaart"],
  [11, 1, "Allerheiligen"],
  [11, 11, "Wapenstilstand"],
  [12, 25, "Kerstmis"],
];

/** Easter-relative public holidays, as an offset in days from Easter Sunday. */
const EASTER_BASED: ReadonlyArray<readonly [offset: number, name: string]> = [
  [1, "Paasmaandag"],
  [39, "Onze-Lieve-Heer-Hemelvaart"],
  [50, "Pinkstermaandag"],
];

/**
 * Resolve every public-holiday event in `[from, to]` (inclusive),
 * inputs in `YYYY-MM-DD`.
 */
export function holidaysInRange(
  from: string,
  to: string,
  opts: HolidayProviderOptions,
): ReadonlyArray<DayEvent> {
  const fromDate = parseISO(from);
  const toDate = parseISO(to);
  if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) return [];
  if (opts.country.toUpperCase() !== "BE") return [];

  const all: DayEvent[] = [];
  for (let y = fromDate.getFullYear(); y <= toDate.getFullYear(); y++) {
    for (const ev of holidaysForYear(y)) {
      if (ev.date >= from && ev.date <= to) all.push(ev);
    }
  }
  return all;
}

function holidaysForYear(year: number): ReadonlyArray<DayEvent> {
  const cached = CACHE.get(String(year));
  if (cached) return cached;

  const dated: Array<{ date: string; name: string }> = FIXED.map(([m, d, name]) => ({
    date: ymd(year, m, d),
    name,
  }));

  const easter = easterSunday(year);
  for (const [offset, name] of EASTER_BASED) {
    dated.push({ date: addDays(easter, offset), name });
  }

  dated.sort((a, b) => a.date.localeCompare(b.date));

  const events: DayEvent[] = dated.map(({ date, name }) => ({
    id: `holidays:be:${date}:${slugify(name)}`,
    date,
    kind: "holiday",
    source: "holidays:be",
    label: name,
  }));

  CACHE.set(String(year), events);
  return events;
}

/** Gregorian Easter Sunday (Anonymous algorithm) as a `YYYY-MM-DD` string. */
function easterSunday(year: number): string {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31); // 3 = March, 4 = April
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return ymd(year, month, day);
}

/** Add `n` calendar days to a `YYYY-MM-DD` string (timezone-safe whole-day add). */
function addDays(iso: string, n: number): string {
  return format(addDaysFns(parseISO(iso), n), "yyyy-MM-dd");
}

function ymd(year: number, month: number, day: number): string {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

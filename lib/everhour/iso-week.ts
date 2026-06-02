import { getISOWeek, getISOWeekYear, parseISO } from "date-fns";

/**
 * ISO 8601 week label for a date.
 *
 * The Everhour API exposes weeks by their Monday-start date and an opaque
 * numeric id; we project that into `YYYY-Www` (e.g. `2026-W18`) so that the
 * UI and the in-browser cache can use a stable, sortable key independent of
 * Everhour's internal week ids.
 *
 * ISO 8601 (the week containing the year's first Thursday is week 1) is
 * implemented by date-fns' `getISOWeek` / `getISOWeekYear`; the only local
 * concern is the year, which `getISOWeekYear` resolves correctly for the
 * December/January boundary cases.
 *
 * @param fromIso A date in `YYYY-MM-DD` form (any day in the week yields the
 *   correct label).
 * @returns Label of the form `YYYY-Www` (two-digit week, zero-padded).
 */
export function isoWeekLabel(fromIso: string): string {
  const d = parseISO(fromIso);
  return `${getISOWeekYear(d)}-W${String(getISOWeek(d)).padStart(2, "0")}`;
}

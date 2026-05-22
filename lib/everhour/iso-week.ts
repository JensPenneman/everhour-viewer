/**
 * ISO 8601 week label for a date.
 *
 * The Everhour API exposes weeks by their Monday-start date and an opaque
 * numeric id; we project that into `YYYY-Www` (e.g. `2026-W18`) so that the
 * UI and the in-browser cache can use a stable, sortable key independent of
 * Everhour's internal week ids.
 *
 * The algorithm follows ISO 8601: the week containing the year's first
 * Thursday is week 1.
 *
 * @param fromIso A date in `YYYY-MM-DD` form (the Monday of the week is
 *   acceptable; any day in the week yields the correct label).
 * @returns Label of the form `YYYY-Www` (two-digit week, zero-padded).
 */
export function isoWeekLabel(fromIso: string): string {
  const d = new Date(`${fromIso}T00:00:00Z`);
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  // Shift to the Thursday of the same ISO week
  const dayNum = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const diffMs = target.getTime() - firstThursday.getTime();
  const week = 1 + Math.round(diffMs / 604_800_000);
  return `${target.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

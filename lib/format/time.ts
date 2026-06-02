import { addHours } from "date-fns";

/** Real Unicode minus sign (U+2212) — aligns under tabular-nums, unlike a hyphen. */
const MINUS = "−";

/**
 * Human duration in Dutch hours + minutes — the single way time is displayed.
 * `2880 → "48m"`, `4500 → "1u 15m"`, `7200 → "2u"`, `0 → "0m"`.
 *
 * This is the compact *presentation* primitive: it turns a second count into a
 * scannable string. Interval *arithmetic* (elapsed timers, edit deltas) is
 * computed with date-fns (`differenceInSeconds`, …) and the result is fed
 * here. date-fns' own `formatDuration` is deliberately not used — emitting
 * "8u 15m" through it would require either an untyped partial `Locale` or
 * bundling a full locale's data, and it would also show multi-day totals as
 * "2 dagen" rather than the running hour count this UI wants.
 *
 * Rounds to whole minutes (the data is minute-grained in practice); negative
 * inputs use their magnitude — callers that need a sign use
 * {@link fmtSignedDuration}.
 */
export function fmtDuration(seconds: number): string {
  const totalMin = Math.round(Math.abs(seconds) / 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}u`;
  return `${h}u ${m}m`;
}

/**
 * Signed duration for an edit delta, e.g. `-1620 → "−27m"`, `+4500 → "+1u 15m"`,
 * `0 → "—"`. Real minus glyph so signed columns stay aligned under tabular-nums.
 */
export function fmtSignedDuration(seconds: number): string {
  if (seconds === 0) return "—";
  return `${seconds < 0 ? MINUS : "+"}${fmtDuration(seconds)}`;
}

/**
 * Render an Everhour UTC timestamp (`"YYYY-MM-DD HH:MM:SS"`) as a local
 * `"HH:MM"` string, applying the profile timezone offset in hours.
 *
 * Everhour returns history timestamps in UTC and exposes the user's offset
 * separately (`profile.timezone`, e.g. `2` for UTC+2) — a fixed numeric
 * offset, not an IANA zone, so date-fns-tz doesn't apply. We parse to a UTC
 * instant, shift by the offset with date-fns `addHours`, then read the *UTC*
 * fields of the shifted instant. Reading UTC (not local) fields keeps the
 * output correct on a non-UTC developer machine, where `format()` would leak
 * the host zone.
 *
 * When the offset is unknown (`null`) the raw UTC time is returned and the
 * caller is expected to flag it. Returns `""` for unparseable input.
 */
export function fmtLocalTime(utcRaw: string, tzOffsetHours: number | null): string {
  const utc = parseEverhourUtc(utcRaw);
  if (utc === null) return "";
  const shifted = addHours(utc, tzOffsetHours ?? 0);
  return `${pad2(shifted.getUTCHours())}:${pad2(shifted.getUTCMinutes())}`;
}

/**
 * Local wall-clock minutes-since-midnight for an Everhour UTC timestamp,
 * given the timezone offset. Used to place history events on the day
 * timeline. Returns `null` for unparseable input.
 */
export function localMinutesOfDay(utcRaw: string, tzOffsetHours: number | null): number | null {
  const utc = parseEverhourUtc(utcRaw);
  if (utc === null) return null;
  const shifted = addHours(utc, tzOffsetHours ?? 0);
  return shifted.getUTCHours() * 60 + shifted.getUTCMinutes();
}

/**
 * The local calendar date (`YYYY-MM-DD`) of an Everhour UTC timestamp after
 * applying the timezone offset. Use this — not `at.slice(0, 10)`, which is
 * the UTC date — whenever comparing an edit's date to a local day, so a
 * near-midnight edit isn't attributed to the wrong day. Returns `null` for
 * unparseable input.
 */
export function localIsoDate(utcRaw: string, tzOffsetHours: number | null): string | null {
  const utc = parseEverhourUtc(utcRaw);
  if (utc === null) return null;
  const shifted = addHours(utc, tzOffsetHours ?? 0);
  return `${shifted.getUTCFullYear()}-${pad2(shifted.getUTCMonth() + 1)}-${pad2(shifted.getUTCDate())}`;
}

/**
 * Parse a `"YYYY-MM-DD HH:MM:SS"` string as a UTC instant.
 *
 * Everhour omits the timezone designator, and `new Date("… …")` would parse
 * it in the host's local zone — wrong on a non-UTC machine. We parse the
 * fields explicitly and treat them as UTC.
 */
function parseEverhourUtc(raw: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/.exec(raw);
  if (!m) return null;
  const [, y, mo, d, h, mi, s] = m;
  return new Date(Date.UTC(+y!, +mo! - 1, +d!, +h!, +mi!, s ? +s : 0));
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

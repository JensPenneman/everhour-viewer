/** Real Unicode minus sign (U+2212) — aligns under tabular-nums, unlike a hyphen. */
const MINUS = "−";

/**
 * Human duration in Dutch hours + minutes — the single way time is displayed.
 * `2880 → "48m"`, `4500 → "1u 15m"`, `7200 → "2u"`, `0 → "0m"`.
 *
 * Decimal hours ("8.25u") force the reader to do mental arithmetic, so every
 * duration in the UI routes through this instead. Rounds to whole minutes
 * (the data is minute-grained in practice); negative inputs use their
 * magnitude — callers that need a sign use {@link fmtSignedDuration}.
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
 * separately (`profile.timezone`, e.g. `2` for UTC+2). When the offset is
 * unknown (`null`), the raw UTC time is returned and the caller is expected
 * to flag it — silently mislabelling a time is worse than admitting "UTC".
 *
 * Returns `""` for an unparseable input so the UI can fall back gracefully.
 */
export function fmtLocalTime(utcRaw: string, tzOffsetHours: number | null): string {
  const ms = parseEverhourUtc(utcRaw);
  if (ms === null) return "";
  const shifted = new Date(ms + (tzOffsetHours ?? 0) * 3600 * 1000);
  return `${pad2(shifted.getUTCHours())}:${pad2(shifted.getUTCMinutes())}`;
}

/**
 * Local wall-clock minutes-since-midnight for an Everhour UTC timestamp,
 * given the timezone offset. Used to place history events on the day
 * timeline. Returns `null` for unparseable input.
 */
export function localMinutesOfDay(utcRaw: string, tzOffsetHours: number | null): number | null {
  const ms = parseEverhourUtc(utcRaw);
  if (ms === null) return null;
  const shifted = new Date(ms + (tzOffsetHours ?? 0) * 3600 * 1000);
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
  const ms = parseEverhourUtc(utcRaw);
  if (ms === null) return null;
  const shifted = new Date(ms + (tzOffsetHours ?? 0) * 3600 * 1000);
  return `${shifted.getUTCFullYear()}-${pad2(shifted.getUTCMonth() + 1)}-${pad2(shifted.getUTCDate())}`;
}

/**
 * Parse a `"YYYY-MM-DD HH:MM:SS"` string as UTC milliseconds.
 *
 * Everhour omits the timezone designator, and `new Date("… …")` would parse
 * it in the host's local zone — wrong on a non-UTC machine. We parse the
 * fields explicitly and treat them as UTC.
 */
function parseEverhourUtc(raw: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/.exec(raw);
  if (!m) return null;
  const [, y, mo, d, h, mi, s] = m;
  return Date.UTC(+y!, +mo! - 1, +d!, +h!, +mi!, s ? +s : 0);
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

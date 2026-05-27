/**
 * Minimal RFC 5545 / iCalendar parser.
 *
 * Scoped to what the viewer actually needs:
 *   - `VEVENT` blocks only,
 *   - `SUMMARY`, `DTSTART`, `DTEND`, `STATUS`, `CATEGORIES`,
 *   - all-day events (`VALUE=DATE`) — timed events are returned with a
 *     flag so the provider can skip them.
 *
 * Folded lines (a CRLF followed by a SP/HTAB) are unfolded per the spec
 * before parsing. The parser is forgiving: malformed properties are
 * skipped rather than throwing, because real-world calendar exports
 * routinely contain quirks.
 */

export interface IcsEvent {
  readonly uid?: string;
  readonly summary: string;
  /** ISO `YYYY-MM-DD` for all-day, or ISO date-time for timed events. */
  readonly start: string;
  readonly end?: string;
  readonly allDay: boolean;
  readonly status?: "TENTATIVE" | "CONFIRMED" | "CANCELLED";
  readonly categories: ReadonlyArray<string>;
}

export function parseIcs(text: string): ReadonlyArray<IcsEvent> {
  const lines = unfold(text).split(/\r?\n/);
  const events: IcsEvent[] = [];

  let current: Partial<Mutable<IcsEvent>> | null = null;
  let inEvent = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    if (line === "BEGIN:VEVENT") {
      inEvent = true;
      current = { categories: [] };
      continue;
    }
    if (line === "END:VEVENT") {
      if (current && current.summary && current.start) {
        events.push({
          ...(current.uid !== undefined ? { uid: current.uid } : {}),
          summary: current.summary,
          start: current.start,
          ...(current.end !== undefined ? { end: current.end } : {}),
          allDay: current.allDay ?? false,
          ...(current.status !== undefined ? { status: current.status } : {}),
          categories: current.categories ?? [],
        });
      }
      current = null;
      inEvent = false;
      continue;
    }
    if (!inEvent || !current) continue;

    const parsed = parseProperty(line);
    if (!parsed) continue;
    const { name, params, value } = parsed;

    switch (name) {
      case "SUMMARY":
        current.summary = unescape(value);
        break;
      case "UID":
        current.uid = value;
        break;
      case "STATUS":
        current.status = value.toUpperCase() as IcsEvent["status"];
        break;
      case "CATEGORIES":
        current.categories = value
          .split(",")
          .map((c) => c.trim())
          .filter(Boolean);
        break;
      case "DTSTART": {
        const r = parseDateValue(value, params);
        if (r) {
          current.start = r.value;
          current.allDay = r.allDay;
        }
        break;
      }
      case "DTEND": {
        const r = parseDateValue(value, params);
        if (r) current.end = r.value;
        break;
      }
      default:
        // ignore unknown properties
        break;
    }
  }

  return events;
}

interface ParsedProperty {
  readonly name: string;
  readonly params: ReadonlyMap<string, string>;
  readonly value: string;
}

function parseProperty(line: string): ParsedProperty | null {
  const colonIdx = line.indexOf(":");
  if (colonIdx < 0) return null;
  const head = line.slice(0, colonIdx);
  const value = line.slice(colonIdx + 1);
  const [name, ...paramParts] = head.split(";");
  if (!name) return null;
  const params = new Map<string, string>();
  for (const part of paramParts) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    params.set(part.slice(0, eq).toUpperCase(), part.slice(eq + 1));
  }
  return { name: name.toUpperCase(), params, value };
}

interface DateValue {
  readonly value: string;
  readonly allDay: boolean;
}

function parseDateValue(value: string, params: ReadonlyMap<string, string>): DateValue | null {
  const valueType = params.get("VALUE");
  // All-day: VALUE=DATE, format YYYYMMDD
  if (valueType === "DATE" || /^\d{8}$/.test(value)) {
    const m = value.match(/^(\d{4})(\d{2})(\d{2})$/);
    if (!m) return null;
    return { value: `${m[1]}-${m[2]}-${m[3]}`, allDay: true };
  }
  // Timed: YYYYMMDDTHHMMSS (with optional Z)
  const m = value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/);
  if (m) {
    return {
      value: `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}${m[7] ?? ""}`,
      allDay: false,
    };
  }
  return null;
}

function unfold(text: string): string {
  // RFC 5545 §3.1: continuation lines start with a single space or tab.
  return text.replace(/\r?\n[ \t]/g, "");
}

function unescape(value: string): string {
  return value
    .replace(/\\n/gi, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\");
}

type Mutable<T> = { -readonly [K in keyof T]: T[K] extends ReadonlyArray<infer U> ? U[] : T[K] };

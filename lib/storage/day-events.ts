import type { DayEvent } from "@/lib/events";
import { STORAGE_KEYS } from "./keys";

interface DayEventsFile {
  readonly schemaVersion: 1;
  readonly events: ReadonlyArray<DayEvent>;
}

/**
 * Read manually-created day events from `localStorage`.
 *
 * Only events with `source: "manual"` are persisted here; everything
 * else (e.g. holidays, ICS-imported events) is derived at runtime by
 * the provider registry.
 *
 * Returns `[]` on missing/corrupt cache rather than throwing — broken
 * storage should never crash the app.
 */
export function readManualEvents(): ReadonlyArray<DayEvent> {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.dayEvents);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<DayEventsFile>;
    if (!Array.isArray(parsed.events)) return EMPTY;
    return parsed.events.filter((e): e is DayEvent => isManualEvent(e));
  } catch {
    return EMPTY;
  }
}

const EMPTY: ReadonlyArray<DayEvent> = Object.freeze([]);

/**
 * Persist the given set of manual events.
 *
 * Dispatches a `storage` event so in-tab `useSyncExternalStore`
 * subscribers refresh — the native `storage` event only fires across
 * tabs.
 */
export function writeManualEvents(events: ReadonlyArray<DayEvent>): boolean {
  if (typeof window === "undefined") return false;
  try {
    const payload: DayEventsFile = {
      schemaVersion: 1,
      events: events.filter((e): e is DayEvent => isManualEvent(e)),
    };
    window.localStorage.setItem(STORAGE_KEYS.dayEvents, JSON.stringify(payload));
    window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEYS.dayEvents }));
    return true;
  } catch {
    return false;
  }
}

function isManualEvent(e: unknown): e is DayEvent {
  if (!e || typeof e !== "object") return false;
  const x = e as Record<string, unknown>;
  return (
    typeof x["id"] === "string" &&
    typeof x["date"] === "string" &&
    typeof x["kind"] === "string" &&
    typeof x["label"] === "string" &&
    x["source"] === "manual"
  );
}

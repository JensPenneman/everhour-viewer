import type { DayEvent } from "@/lib/events";
import { clearProviderStorage, readProviderJson, writeProviderJson } from "../storage";
import type { Provider } from "../types";
import { classifySummary } from "./classifier";
import { parseIcs, type IcsEvent } from "./parser";

interface IcsStorageShape {
  readonly schemaVersion: 1;
  readonly importedAt: string;
  readonly sourceName: string;
  readonly events: ReadonlyArray<DayEvent>;
}

const PROVIDER_ID = "ics:imported";

function storedEvents(): IcsStorageShape | null {
  return readProviderJson<IcsStorageShape>(PROVIDER_ID, "events");
}

/**
 * Parse a raw `.ics` file's text into {@link DayEvent}s.
 *
 * Time-bounded events are dropped — only all-day entries are kept,
 * because per-day overlays don't have meaningful hours for a 14:00–15:00
 * meeting. (A future "calendar" view could surface timed events as a
 * separate signal type.)
 */
export function icsToDayEvents(text: string): ReadonlyArray<DayEvent> {
  const parsed = parseIcs(text);
  return parsed
    .filter((e) => e.allDay && e.status !== "CANCELLED")
    .map((e) => toDayEvent(e))
    .filter((e): e is DayEvent => e !== null);
}

function toDayEvent(e: IcsEvent): DayEvent | null {
  if (!e.start || e.start.length !== 10) return null;
  const id = `${PROVIDER_ID}:${e.uid ?? e.start}-${slug(e.summary)}`;
  return {
    id,
    date: e.start,
    kind: classifySummary(e.summary),
    source: PROVIDER_ID,
    label: e.summary,
  };
}

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/** Import a new .ics file, replacing any previously imported one. */
export function importIcsFile(name: string, text: string): { count: number } {
  const events = icsToDayEvents(text);
  writeProviderJson<IcsStorageShape>(PROVIDER_ID, "events", {
    schemaVersion: 1,
    importedAt: new Date().toISOString(),
    sourceName: name,
    events,
  });
  return { count: events.length };
}

export function clearIcsImport(): void {
  clearProviderStorage(PROVIDER_ID, "events");
}

export function icsImportSummary(): { name: string; importedAt: string; count: number } | null {
  const stored = storedEvents();
  if (!stored) return null;
  return { name: stored.sourceName, importedAt: stored.importedAt, count: stored.events.length };
}

export const icsProvider: Provider = {
  meta: {
    id: PROVIDER_ID,
    name: "Kalender import (.ics)",
    description:
      "Importeer een geëxporteerde .ics van Outlook, Google of Apple Calendar. " +
      "Alleen hele-dag events worden gebruikt; meetings worden overgeslagen.",
    category: "calendar",
    icon: "📅",
  },
  status() {
    const summary = icsImportSummary();
    if (!summary) {
      return { ready: false, message: "Geen kalender geladen." };
    }
    const dateStr = summary.importedAt.slice(0, 10);
    return {
      ready: true,
      message: `${summary.name} · geïmporteerd ${dateStr}`,
      eventCount: summary.count,
    };
  },
  async fetchEvents({ from, to }) {
    const stored = storedEvents();
    if (!stored) return [];
    return stored.events.filter((e) => e.date >= from && e.date <= to);
  },
};

export { parseIcs, classifySummary };

import { STORAGE_KEYS } from "./keys";

/**
 * The per-day "saved minutes" ledger — a signed running tally of corrections
 * for time mis-logged because a timer was forgotten.
 *
 * Positive entries = time you worked but didn't track (forgot to start → lost
 * time to add back). Negative entries = time you over-logged (forgot to stop).
 * The day's *net* is what gets applied to a ticket: the app starts a real timer
 * on the chosen ticket and runs it for the net (when positive), since this key
 * can't add time directly. Over-runs of that apply-timer are pushed back as a
 * negative `auto` entry so the bank self-corrects.
 *
 * Persisted as one versioned blob keyed by local date (mirroring
 * {@link readManualEvents}). Keeping all days in a single blob makes day
 * rollover trivial — today simply reads its own slice.
 */

export interface LedgerEntry {
  readonly id: string;
  /** Signed minutes (may be fractional for auto-corrections). */
  readonly minutes: number;
  readonly note: string;
  readonly createdAt: number;
  /** True for app-generated corrections (apply offset / over-run rebank). */
  readonly auto?: boolean;
}

export interface DayLedger {
  readonly date: string;
  readonly entries: ReadonlyArray<LedgerEntry>;
}

export interface LedgerFile {
  readonly schemaVersion: 1;
  /** Keyed by local `YYYY-MM-DD`. */
  readonly days: Readonly<Record<string, DayLedger>>;
}

export const EMPTY_LEDGER_FILE: LedgerFile = Object.freeze({ schemaVersion: 1, days: {} });

let lastRaw: string | null | undefined;
let snapshot: LedgerFile = EMPTY_LEDGER_FILE;

/**
 * Same-tab subscribers, notified directly. A synthetic `StorageEvent` is unsafe
 * here: other "storage" listeners (e.g. React Query Devtools) read its null
 * `newValue` as a deletion and wipe the key we just wrote. The native event is
 * kept only for genuine cross-tab changes.
 */
const listeners = new Set<() => void>();

function parse(raw: string | null): LedgerFile {
  if (!raw) return EMPTY_LEDGER_FILE;
  try {
    const file = JSON.parse(raw) as Partial<LedgerFile>;
    if (!file.days || typeof file.days !== "object") return EMPTY_LEDGER_FILE;
    const days: Record<string, DayLedger> = {};
    for (const [date, day] of Object.entries(file.days)) {
      if (day && Array.isArray(day.entries)) {
        days[date] = { date, entries: day.entries.filter(isEntry) };
      }
    }
    return { schemaVersion: 1, days };
  } catch {
    return EMPTY_LEDGER_FILE;
  }
}

/** Read the whole ledger file (SSR-safe; stable reference while unchanged). */
export function readLedgerFile(): LedgerFile {
  if (typeof window === "undefined") return EMPTY_LEDGER_FILE;
  const raw = window.localStorage.getItem(STORAGE_KEYS.savedMinutes);
  if (raw === lastRaw) return snapshot;
  lastRaw = raw;
  snapshot = parse(raw);
  return snapshot;
}

/** Persist the whole ledger file and wake same-tab subscribers. */
export function writeLedgerFile(file: LedgerFile): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(STORAGE_KEYS.savedMinutes, JSON.stringify(file));
  } catch {
    return false;
  }
  // Notify same-tab subscribers directly (see `listeners` above).
  for (const l of listeners) l();
  return true;
}

/** Subscribe a `useSyncExternalStore` to ledger changes (same-tab + cross-tab). */
export function subscribeLedger(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  listeners.add(onChange);
  const handler = (e: StorageEvent) => {
    if (e.key === null || e.key === STORAGE_KEYS.savedMinutes) onChange();
  };
  window.addEventListener("storage", handler);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", handler);
  };
}

function isEntry(e: unknown): e is LedgerEntry {
  if (!e || typeof e !== "object") return false;
  const x = e as Record<string, unknown>;
  return (
    typeof x["id"] === "string" &&
    typeof x["minutes"] === "number" &&
    typeof x["note"] === "string" &&
    typeof x["createdAt"] === "number"
  );
}

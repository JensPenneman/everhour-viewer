import type { DayLedger, LedgerEntry, LedgerFile } from "@/lib/storage";
import { EMPTY_LEDGER_FILE } from "@/lib/storage";

/**
 * Pure ledger math for the "Gespaarde minuten" feature — no storage, no React,
 * so every rule is unit-testable in isolation. The hook ({@link useLedger})
 * supplies `now`/`id` and persists the results.
 */

/** Net signed minutes for a day (sum of all entries; 0 when none). */
export function netMinutes(day: DayLedger | undefined): number {
  if (!day) return 0;
  return day.entries.reduce((acc, e) => acc + e.minutes, 0);
}

/** Seconds an apply timer should run for a given net — only positive nets apply. */
export function applyableSeconds(netMin: number): number {
  return netMin > 0 ? Math.round(netMin * 60) : 0;
}

export function emptyDay(date: string): DayLedger {
  return { date, entries: [] };
}

export interface MakeEntryOpts {
  readonly now: number;
  readonly id: string;
  readonly auto?: boolean;
}

export function makeEntry(minutes: number, note: string, opts: MakeEntryOpts): LedgerEntry {
  return {
    id: opts.id,
    minutes,
    note,
    createdAt: opts.now,
    ...(opts.auto ? { auto: true } : {}),
  };
}

export function addEntry(day: DayLedger, entry: LedgerEntry): DayLedger {
  return { date: day.date, entries: [...day.entries, entry] };
}

export function removeEntry(day: DayLedger, id: string): DayLedger {
  return { date: day.date, entries: day.entries.filter((e) => e.id !== id) };
}

/** The day's slice from a file, or an empty day when absent. */
export function getDay(file: LedgerFile, date: string): DayLedger {
  return file.days[date] ?? emptyDay(date);
}

/** Upsert a day back into a file (dropping it entirely when it has no entries). */
export function withDay(file: LedgerFile, day: DayLedger): LedgerFile {
  const days = { ...file.days };
  if (day.entries.length === 0) delete days[day.date];
  else days[day.date] = day;
  return { schemaVersion: 1, days };
}

/** Most recent day (by date key) other than `exclude` that has a non-zero net. */
export function latestOtherNonZeroDay(
  file: LedgerFile = EMPTY_LEDGER_FILE,
  exclude: string,
): DayLedger | null {
  const days = Object.values(file.days)
    .filter((d) => d.date !== exclude && netMinutes(d) !== 0)
    .sort((a, b) => b.date.localeCompare(a.date));
  return days[0] ?? null;
}

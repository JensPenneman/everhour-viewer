"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import {
  EMPTY_LEDGER_FILE,
  readLedgerFile,
  subscribeLedger,
  writeLedgerFile,
  type DayLedger,
  type LedgerEntry,
} from "@/lib/storage";
import {
  addEntry,
  getDay,
  latestOtherNonZeroDay,
  makeEntry,
  netMinutes as netMinutesOf,
  netMinutesInRange,
  removeEntry,
  withDay,
} from "../lib/ledger";

export interface LedgerApi {
  readonly day: DayLedger;
  readonly entries: ReadonlyArray<LedgerEntry>;
  readonly netMinutes: number;
  /** Most recent earlier day with a non-zero balance (to surface a carry-over hint). */
  readonly carryover: DayLedger | null;
  /** Net signed minutes across an inclusive date range (e.g. this week-to-date). */
  readonly netInRange: (from: string, to: string) => number;
  /** Bank a signed manual correction (+ lost time / − over-logged). */
  readonly add: (minutes: number, note?: string) => void;
  readonly remove: (id: string) => void;
  /** Bank an app-generated correction (apply offset / over-run rebank). */
  readonly bookAuto: (minutes: number, note: string) => void;
  /** Pull an earlier day's entries into today (explicit carry-over). */
  readonly moveDayToToday: (date: string) => void;
}

function newId(): string {
  try {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  } catch {
    // fall through to the time+random id below
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Reactive per-day saved-minutes ledger. Pure math lives in `../lib/ledger`. */
export function useLedger(today: string): LedgerApi {
  const file = useSyncExternalStore(subscribeLedger, readLedgerFile, () => EMPTY_LEDGER_FILE);
  const day = useMemo(() => getDay(file, today), [file, today]);
  const net = useMemo(() => netMinutesOf(day), [day]);
  const carryover = useMemo(() => latestOtherNonZeroDay(file, today), [file, today]);
  const netInRange = useCallback(
    (from: string, to: string) => netMinutesInRange(file, from, to),
    [file],
  );

  const add = useCallback(
    (minutes: number, note = "") => {
      if (!minutes) return;
      const cur = readLedgerFile();
      const entry = makeEntry(minutes, note, { now: Date.now(), id: newId() });
      writeLedgerFile(withDay(cur, addEntry(getDay(cur, today), entry)));
    },
    [today],
  );

  const bookAuto = useCallback(
    (minutes: number, note: string) => {
      if (!minutes) return;
      const cur = readLedgerFile();
      const entry = makeEntry(minutes, note, { now: Date.now(), id: newId(), auto: true });
      writeLedgerFile(withDay(cur, addEntry(getDay(cur, today), entry)));
    },
    [today],
  );

  const remove = useCallback(
    (id: string) => {
      const cur = readLedgerFile();
      writeLedgerFile(withDay(cur, removeEntry(getDay(cur, today), id)));
    },
    [today],
  );

  const moveDayToToday = useCallback(
    (date: string) => {
      if (date === today) return;
      const cur = readLedgerFile();
      const from = cur.days[date];
      if (!from || from.entries.length === 0) return;
      let merged = getDay(cur, today);
      for (const e of from.entries) merged = addEntry(merged, e);
      writeLedgerFile(withDay(withDay(cur, merged), { date, entries: [] }));
    },
    [today],
  );

  return {
    day,
    entries: day.entries,
    netMinutes: net,
    carryover,
    netInRange,
    add,
    remove,
    bookAuto,
    moveDayToToday,
  };
}

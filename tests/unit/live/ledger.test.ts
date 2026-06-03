import { describe, expect, it } from "vitest";
import type { DayLedger, LedgerFile } from "@/lib/storage";
import {
  addEntry,
  applyableSeconds,
  emptyDay,
  getDay,
  latestOtherNonZeroDay,
  makeEntry,
  netMinutes,
  removeEntry,
  withDay,
} from "@/features/live/lib/ledger";

const e = (id: string, minutes: number): ReturnType<typeof makeEntry> =>
  makeEntry(minutes, "", { now: 0, id });

const day = (date: string, mins: number[]): DayLedger => ({
  date,
  entries: mins.map((m, i) => e(`${date}-${i}`, m)),
});

describe("ledger — net + apply", () => {
  it("netMinutes sums signed entries (0 when absent)", () => {
    expect(netMinutes(undefined)).toBe(0);
    expect(netMinutes(emptyDay("2026-06-03"))).toBe(0);
    expect(netMinutes(day("2026-06-03", [15, -5, 10]))).toBe(20);
  });

  it("applyableSeconds only applies a positive net", () => {
    expect(applyableSeconds(15)).toBe(900);
    expect(applyableSeconds(0)).toBe(0);
    expect(applyableSeconds(-10)).toBe(0);
    expect(applyableSeconds(14.5)).toBe(870);
  });
});

describe("ledger — entries", () => {
  it("makeEntry carries sign, note, and the auto flag", () => {
    const m = makeEntry(-12, "te lang", { now: 42, id: "x", auto: true });
    expect(m).toMatchObject({ id: "x", minutes: -12, note: "te lang", createdAt: 42, auto: true });
    const plain = makeEntry(5, "", { now: 1, id: "y" });
    expect(plain.auto).toBeUndefined();
  });

  it("addEntry / removeEntry are immutable", () => {
    const d0 = emptyDay("2026-06-03");
    const d1 = addEntry(d0, e("a", 5));
    expect(d0.entries).toHaveLength(0);
    expect(d1.entries).toHaveLength(1);
    const d2 = removeEntry(d1, "a");
    expect(d2.entries).toHaveLength(0);
    expect(d1.entries).toHaveLength(1);
  });
});

describe("ledger — file helpers", () => {
  const file: LedgerFile = {
    schemaVersion: 1,
    days: { "2026-06-01": day("2026-06-01", [10]), "2026-06-02": day("2026-06-02", [5, -5]) },
  };

  it("getDay returns the slice or an empty day", () => {
    expect(getDay(file, "2026-06-01").entries).toHaveLength(1);
    expect(getDay(file, "2099-01-01").entries).toHaveLength(0);
  });

  it("withDay upserts, and drops a day once it is empty", () => {
    const added = withDay(file, addEntry(getDay(file, "2026-06-03"), e("n", 7)));
    expect(netMinutes(added.days["2026-06-03"])).toBe(7);
    const cleared = withDay(added, emptyDay("2026-06-03"));
    expect(cleared.days["2026-06-03"]).toBeUndefined();
  });

  it("latestOtherNonZeroDay finds the most recent non-zero day other than today", () => {
    // 2026-06-02 nets to 0 → skipped; 2026-06-01 is the non-zero carry-over.
    expect(latestOtherNonZeroDay(file, "2026-06-03")?.date).toBe("2026-06-01");
    // Excluding the only non-zero day yields null.
    expect(latestOtherNonZeroDay(file, "2026-06-01")).toBeNull();
  });
});

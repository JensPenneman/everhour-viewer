import { describe, it, expect } from "vitest";
import type { WeekDay, WeekEntry, WeekRecord, WeekTaskRef } from "@/lib/everhour";
import { recentTasks } from "@/lib/live/recent-tasks";

function task(id: string): WeekTaskRef {
  return { id, name: id.toUpperCase(), linearKey: id.toUpperCase(), url: null, labels: [] };
}

function entry(id: string): WeekEntry {
  return { task: task(id), seconds: 3600, lockReasons: [] };
}

function day(date: string, ids: string[]): WeekDay {
  return { date, weekday: "x", totalSeconds: ids.length * 3600, entries: ids.map(entry) };
}

function week(from: string, days: WeekDay[]): WeekRecord {
  return {
    schemaVersion: 3,
    exportedAt: "",
    user: { id: 1, name: "t", email: "t@e.com" },
    week: { isoWeek: from, weekId: 1, from, to: from },
    approval: { status: "unsubmitted", submittedAt: null, history: [] },
    totals: { seconds: 0, hours: 0 },
    days,
  };
}

describe("recentTasks", () => {
  it("returns the most recently tracked tasks, newest first and de-duplicated", () => {
    const weeks = [
      week("2026-W22", [day("2026-05-26", ["a", "b"])]),
      week("2026-W23", [
        day("2026-06-01", ["c"]),
        day("2026-06-02", ["a", "d"]), // newest day
      ]),
    ];
    const recent = recentTasks(weeks).map((t) => t.id);
    // 2 Jun (a,d) → 1 Jun (c) → 26 May (b; a already seen)
    expect(recent).toEqual(["a", "d", "c", "b"]);
  });

  it("respects the limit", () => {
    const weeks = [week("2026-W23", [day("2026-06-02", ["a", "b", "c", "d", "e"])])];
    expect(recentTasks(weeks, 3)).toHaveLength(3);
  });

  it("returns nothing for empty input", () => {
    expect(recentTasks([])).toEqual([]);
  });
});

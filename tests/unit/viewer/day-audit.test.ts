import { describe, it, expect } from "vitest";
import type { TimeEdit, WeekDay, WeekEntry } from "@/lib/everhour";
import {
  GAP_THRESHOLD_SEC,
  buildChangeLog,
  buildTimeline,
  dayBreaks,
  entryNetEditSeconds,
  entryWasCorrectedByOther,
  foreignCorrectionCount,
  foreignNetEditSeconds,
  isForeignActor,
  resolveActorLabel,
} from "@/components/viewer/day-detail/day-audit";

const OWNER = 1408104; // Jens
const BOSS = 1319953; // Thomas (admin)

function edit(partial: Partial<TimeEdit>): TimeEdit {
  return {
    action: "TIMER",
    deltaSeconds: 0,
    previousSeconds: 0,
    at: "2026-06-01 07:00:00",
    by: OWNER,
    byName: "Jens Penneman",
    fromTaskId: null,
    fromDate: null,
    warning: null,
    ...partial,
  };
}

function entry(seconds: number, history: TimeEdit[], extra?: Partial<WeekEntry>): WeekEntry {
  return {
    task: { id: "t1", name: "Taak", linearKey: "LS-1", url: null, labels: [] },
    seconds,
    lockReasons: [],
    history,
    comment: null,
    ...extra,
  };
}

function day(partial: Partial<WeekDay>): WeekDay {
  return {
    date: "2026-06-01",
    weekday: "Monday",
    totalSeconds: 0,
    entries: [],
    ...partial,
  };
}

describe("isForeignActor", () => {
  it("treats the owner as not foreign", () => {
    expect(isForeignActor(OWNER, OWNER)).toBe(false);
  });
  it("treats another user as foreign", () => {
    expect(isForeignActor(BOSS, OWNER)).toBe(true);
  });
  it("treats an unknown actor as foreign (fail toward visibility)", () => {
    expect(isForeignActor(null, OWNER)).toBe(true);
  });
});

describe("entryNetEditSeconds", () => {
  it("sums only EDIT deltas, signed", () => {
    const e = entry(6720, [
      edit({ action: "TIMER", deltaSeconds: 8340 }),
      edit({ action: "EDIT", deltaSeconds: -1620, by: BOSS }),
    ]);
    expect(entryNetEditSeconds(e)).toBe(-1620);
  });
  it("returns 0 for an entry with no edits", () => {
    expect(entryNetEditSeconds(entry(3600, [edit({ action: "TIMER", deltaSeconds: 3600 })]))).toBe(
      0,
    );
  });
});

describe("foreignNetEditSeconds", () => {
  it("counts only EDITs made by someone other than the owner", () => {
    // Owner trims 30m of their own time; boss only comments. Foreign net = 0,
    // so the row must NOT read as a foreign reduction.
    const e = entry(0, [
      edit({ action: "EDIT", deltaSeconds: -1800, by: OWNER }),
      edit({ action: "COMMENT", deltaSeconds: 0, by: BOSS }),
    ]);
    expect(entryNetEditSeconds(e)).toBe(-1800);
    expect(foreignNetEditSeconds(e, OWNER)).toBe(0);
  });

  it("isolates the boss's signed contribution from the owner's", () => {
    // Boss adds 10m, owner removes 45m → all-actor net -35m, but foreign net +10m.
    const e = entry(0, [
      edit({ action: "EDIT", deltaSeconds: 600, by: BOSS }),
      edit({ action: "EDIT", deltaSeconds: -2700, by: OWNER }),
    ]);
    expect(entryNetEditSeconds(e)).toBe(-2100);
    expect(foreignNetEditSeconds(e, OWNER)).toBe(600);
  });
});

describe("resolveActorLabel", () => {
  it("prefers a resolved name", () => {
    expect(resolveActorLabel("Thomas Blommaert", BOSS)).toBe("Thomas Blommaert");
  });
  it("falls back to the numeric id when the name is unknown", () => {
    expect(resolveActorLabel(null, 999)).toBe("Gebruiker #999");
  });
  it("falls back to a generic label when neither is known", () => {
    expect(resolveActorLabel(null, null)).toBe("Onbekende gebruiker");
  });
});

describe("entryWasCorrectedByOther", () => {
  it("is true when a foreign EDIT exists", () => {
    const e = entry(6720, [edit({ action: "EDIT", deltaSeconds: -1620, by: BOSS })]);
    expect(entryWasCorrectedByOther(e, OWNER)).toBe(true);
  });
  it("is true for a foreign COMMENT with no time change", () => {
    const e = entry(8340, [edit({ action: "COMMENT", deltaSeconds: 0, by: BOSS })]);
    expect(entryWasCorrectedByOther(e, OWNER)).toBe(true);
  });
  it("is false when the owner edits their own entry", () => {
    const e = entry(6720, [edit({ action: "EDIT", deltaSeconds: 600, by: OWNER })]);
    expect(entryWasCorrectedByOther(e, OWNER)).toBe(false);
  });
});

describe("buildChangeLog", () => {
  it("surfaces a foreign correction with cumulative new total and actor name", () => {
    // The real 1 Jun LS-2109 case: Jens timed to 8340s, Thomas commented then cut 27 min.
    const e = entry(
      6720,
      [
        edit({ action: "TIMER", deltaSeconds: 60, previousSeconds: 0, at: "2026-06-01 07:10:09" }),
        edit({
          action: "TIMER",
          deltaSeconds: 8280,
          previousSeconds: 60,
          at: "2026-06-01 13:00:49",
        }),
        edit({
          action: "COMMENT",
          deltaSeconds: 0,
          previousSeconds: 8340,
          at: "2026-06-01 14:53:48",
          by: BOSS,
          byName: "Thomas Blommaert",
        }),
        edit({
          action: "EDIT",
          deltaSeconds: -1620,
          previousSeconds: 8340,
          at: "2026-06-01 14:53:50",
          by: BOSS,
          byName: "Thomas Blommaert",
        }),
      ],
      { comment: "Correctie lunch" },
    );

    const log = buildChangeLog(day({ entries: [e] }), OWNER);

    // The comment-by-Thomas is folded into Thomas's edit row, so just one row.
    expect(log).toHaveLength(1);
    const row = log[0]!;
    expect(row.edit.action).toBe("EDIT");
    expect(row.isForeign).toBe(true);
    expect(row.actorLabel).toBe("Thomas Blommaert");
    expect(row.newSeconds).toBe(6720); // 8340 - 1620
    expect(row.comment).toBe("Correctie lunch");
  });

  it("labels an owner edit as 'Jij' and not foreign", () => {
    const e = entry(2400, [edit({ action: "EDIT", deltaSeconds: 600, by: OWNER })]);
    const log = buildChangeLog(day({ entries: [e] }), OWNER);
    expect(log).toHaveLength(1);
    expect(log[0]!.isForeign).toBe(false);
    expect(log[0]!.actorLabel).toBe("Jij");
  });

  it("shows a standalone foreign comment (boss commented, no edit)", () => {
    const e = entry(
      8340,
      [edit({ action: "COMMENT", deltaSeconds: 0, by: BOSS, byName: "Thomas Blommaert" })],
      {
        comment: "Graag opsplitsen",
      },
    );
    const log = buildChangeLog(day({ entries: [e] }), OWNER);
    expect(log).toHaveLength(1);
    expect(log[0]!.edit.action).toBe("COMMENT");
    expect(log[0]!.isForeign).toBe(true);
  });

  it("ignores plain TIMER actions", () => {
    const e = entry(3600, [edit({ action: "TIMER", deltaSeconds: 3600 })]);
    expect(buildChangeLog(day({ entries: [e] }), OWNER)).toHaveLength(0);
  });

  it("does not fold a null-actor comment into an unrelated null-actor edit", () => {
    // Two distinct integration/ex-user records (both by === null): the
    // standalone comment must survive as its own row, not be merged away.
    const e = entry(600, [
      edit({ action: "EDIT", deltaSeconds: 600, by: null, byName: null }),
      edit({ action: "COMMENT", deltaSeconds: 0, by: null, byName: null }),
    ]);
    const log = buildChangeLog(day({ entries: [e] }), OWNER);
    expect(log).toHaveLength(2);
    expect(log.some((r) => r.edit.action === "COMMENT")).toBe(true);
    expect(foreignCorrectionCount(log)).toBe(2); // both are foreign (null != owner)
  });

  it("sorts newest first across entries", () => {
    const a = entry(600, [edit({ action: "EDIT", deltaSeconds: 600, at: "2026-06-01 09:00:00" })]);
    const b = entry(600, [edit({ action: "EDIT", deltaSeconds: 600, at: "2026-06-01 16:00:00" })]);
    const log = buildChangeLog(day({ entries: [a, b] }), OWNER);
    expect(log.map((r) => r.edit.at)).toEqual(["2026-06-01 16:00:00", "2026-06-01 09:00:00"]);
  });
});

describe("foreignCorrectionCount", () => {
  it("counts only foreign rows", () => {
    const e = entry(600, [
      edit({ action: "EDIT", deltaSeconds: 600, by: OWNER }),
      edit({ action: "EDIT", deltaSeconds: -120, by: BOSS, at: "2026-06-01 17:00:00" }),
    ]);
    const log = buildChangeLog(day({ entries: [e] }), OWNER);
    expect(foreignCorrectionCount(log)).toBe(1);
  });
});

describe("dayBreaks", () => {
  it("derives the break as attendance − tracked", () => {
    // 1 Jun: present 09:09–18:01, tracked 8h25m → ~27m break.
    const d = day({
      clockIn: "09:09",
      clockOut: "18:01",
      workTime: 31920,
      entries: [entry(30300, [])], // 8h25m tracked
    });
    const b = dayBreaks(d);
    expect(b.attendanceSec).toBe(31920);
    expect(b.trackedSec).toBe(30300);
    expect(b.breakSec).toBe(1620);
    expect(b.hasClockOut).toBe(true);
  });

  it("flags an automatic day-end close", () => {
    const d = day({
      clockIn: "09:09",
      clockOut: "18:01",
      workTime: 31920,
      entries: [entry(30300, [])],
      clockHistory: [
        { action: "clock-in", trigger: "timer", at: "", localTime: "9:09", by: OWNER, byName: "J" },
        {
          action: "clock-out",
          trigger: "day-end",
          at: "",
          localTime: "18:01",
          by: OWNER,
          byName: "J",
        },
      ],
    });
    expect(dayBreaks(d).autoClosed).toBe(true);
  });

  it("clamps break to zero and flags over-tracking when tracked exceeds attendance", () => {
    const d = day({
      clockIn: "09:00",
      clockOut: "17:00",
      workTime: 28800,
      entries: [entry(30000, [])],
    });
    const b = dayBreaks(d);
    expect(b.breakSec).toBe(0);
    expect(b.overTracked).toBe(true);
  });

  it("returns a null break when the day has no clock-out (still open)", () => {
    const d = day({ clockIn: "07:58", clockOut: null, workTime: null, entries: [entry(3600, [])] });
    const b = dayBreaks(d);
    expect(b.hasClockOut).toBe(false);
    expect(b.breakSec).toBeNull();
  });

  it("handles an overnight shift without a negative attendance span", () => {
    // 22:00 → 02:00 crosses midnight: 4h attendance, not -20h.
    const d = day({
      clockIn: "22:00",
      clockOut: "02:00",
      workTime: null,
      entries: [entry(10800, [])],
    });
    const b = dayBreaks(d);
    expect(b.attendanceSec).toBe(4 * 3600);
    expect(b.breakSec).toBe(3600);
    expect(b.overTracked).toBe(false);
  });

  it("does not flag over-tracking on an open day even if workTime lags behind", () => {
    const d = day({ clockIn: "09:00", clockOut: null, workTime: 3600, entries: [entry(5400, [])] });
    const b = dayBreaks(d);
    expect(b.hasClockOut).toBe(false);
    expect(b.overTracked).toBe(false); // → "dag nog bezig", not "meer getrackt dan aanwezig"
    expect(b.breakSec).toBeNull();
  });
});

describe("buildTimeline", () => {
  it("places, merges, and finds gaps between tracked chunks", () => {
    // Morning chunk saved 10:00 lasting 1h (09:00–10:00), afternoon chunk
    // saved 16:00 lasting 1h (15:00–16:00): a 5h gap between them.
    const e = entry(7200, [
      edit({ action: "TIMER", deltaSeconds: 3600, at: "2026-06-01 08:00:00" }), // +2 → 10:00 local
      edit({ action: "TIMER", deltaSeconds: 3600, at: "2026-06-01 14:00:00" }), // +2 → 16:00 local
    ]);
    const d = day({ clockIn: "09:00", clockOut: "18:01", entries: [e] });
    const tl = buildTimeline(d, 2);

    expect(tl.hasData).toBe(true);
    expect(tl.tzKnown).toBe(true);
    expect(tl.domainStartMin).toBe(9 * 60);
    expect(tl.segments).toHaveLength(2);
    expect(tl.segments[0]).toEqual({ startMin: 9 * 60, endMin: 10 * 60 });
    expect(tl.gaps).toHaveLength(1);
    expect(tl.gaps[0]).toEqual({ startMin: 10 * 60, endMin: 15 * 60 });
  });

  it("ignores gaps narrower than the threshold", () => {
    const e = entry(7200, [
      edit({ action: "TIMER", deltaSeconds: 3600, at: "2026-06-01 08:00:00" }), // 09:00–10:00
      edit({ action: "TIMER", deltaSeconds: 3600, at: "2026-06-01 09:05:00" }), // 10:05–11:05 → 5m gap
    ]);
    const tl = buildTimeline(day({ clockIn: "09:00", clockOut: "12:00", entries: [e] }), 2);
    expect(GAP_THRESHOLD_SEC).toBe(480);
    expect(tl.gaps).toHaveLength(0);
  });

  it("reports tzKnown=false when the offset is unknown", () => {
    const e = entry(3600, [
      edit({ action: "TIMER", deltaSeconds: 3600, at: "2026-06-01 08:00:00" }),
    ]);
    expect(buildTimeline(day({ entries: [e] }), null).tzKnown).toBe(false);
  });

  it("has no data when there are no timer chunks", () => {
    expect(buildTimeline(day({ clockIn: "09:00", clockOut: "17:00" }), 2).hasData).toBe(false);
  });
});

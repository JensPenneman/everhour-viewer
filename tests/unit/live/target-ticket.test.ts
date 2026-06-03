import { describe, expect, it } from "vitest";
import type { LiveEntry, TaskHit, WeekTaskRef } from "@/lib/everhour";
import { candidateTargets, pickApplyTarget, toMeta } from "@/features/live/lib/target-ticket";

const hit = (id: string, name = id): TaskHit => ({
  id,
  name,
  linearKey: null,
  url: null,
  status: null,
});
const entry = (id: string): LiveEntry => ({ date: "2026-06-03", seconds: 60, task: hit(id) });
const ref = (id: string): WeekTaskRef => ({ id, name: id, linearKey: null, url: null, labels: [] });

describe("target-ticket — toMeta", () => {
  it("projects to id/name/linearKey/url", () => {
    expect(toMeta(hit("a", "Alpha"))).toEqual({
      id: "a",
      name: "Alpha",
      linearKey: null,
      url: null,
    });
  });
});

describe("target-ticket — pickApplyTarget", () => {
  it("prefers the last today entry", () => {
    const t = pickApplyTarget({
      todayEntries: [entry("a"), entry("b")],
      runningTask: hit("run"),
      recent: [ref("r")],
    });
    expect(t?.id).toBe("b");
  });

  it("falls back to the running task, then recent, then null", () => {
    expect(
      pickApplyTarget({ todayEntries: [], runningTask: hit("run"), recent: [ref("r")] })?.id,
    ).toBe("run");
    expect(pickApplyTarget({ todayEntries: [], runningTask: null, recent: [ref("r")] })?.id).toBe(
      "r",
    );
    expect(pickApplyTarget({ todayEntries: [], runningTask: null, recent: [] })).toBeNull();
  });

  it("ignores entries whose task has an empty id", () => {
    const t = pickApplyTarget({
      todayEntries: [entry("a"), entry("")],
      runningTask: null,
      recent: [],
    });
    expect(t?.id).toBe("a");
  });
});

describe("target-ticket — candidateTargets", () => {
  it("dedups across today / running / recent, last-today first", () => {
    const list = candidateTargets({
      todayEntries: [entry("a"), entry("b")],
      runningTask: hit("b"), // dup of a today entry
      recent: [ref("c"), ref("a")], // 'a' is a dup
    });
    expect(list.map((t) => t.id)).toEqual(["b", "a", "c"]);
  });
});

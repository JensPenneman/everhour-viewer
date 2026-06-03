import { describe, expect, it } from "vitest";
import type { Timer } from "@/lib/everhour";
import type { ScheduledTransition, TaskMeta } from "@/lib/storage";
import {
  buildApplyTransition,
  buildBreakTransition,
  dueState,
  latenessMs,
  reconcileWithTimer,
  remainingMs,
} from "@/features/live/lib/scheduler";

const TASK: TaskMeta = { id: "t1", name: "Task 1", linearKey: "LS-1", url: null };

function sched(over: Partial<ScheduledTransition> = {}): ScheduledTransition {
  return { kind: "start", reason: "break", task: TASK, fireAt: 1000, createdAt: 0, ...over };
}

function timer(running: boolean, id: string | null): Timer {
  return {
    running,
    durationSeconds: 0,
    startedAt: null,
    task: id ? { id, name: "", linearKey: null, url: null, status: null } : null,
  };
}

describe("scheduler — timing", () => {
  it("dueState reflects none / pending / due", () => {
    expect(dueState(null, 0)).toBe("none");
    expect(dueState(sched(), 999)).toBe("pending");
    expect(dueState(sched(), 1000)).toBe("due");
    expect(dueState(sched(), 5000)).toBe("due");
  });

  it("remainingMs and latenessMs are complementary and clamped", () => {
    expect(remainingMs(sched(), 400)).toBe(600);
    expect(remainingMs(sched(), 2000)).toBe(0);
    expect(latenessMs(sched(), 400)).toBe(0);
    expect(latenessMs(sched(), 2500)).toBe(1500);
    expect(remainingMs(null, 0)).toBe(0);
    expect(latenessMs(null, 0)).toBe(0);
  });
});

describe("scheduler — builders", () => {
  it("buildBreakTransition resumes the task after the break", () => {
    const t = buildBreakTransition(TASK, 15 * 60_000, 1_000);
    expect(t).toMatchObject({ kind: "start", reason: "break", fireAt: 1_000 + 900_000 });
    expect(t.task).toBe(TASK);
  });

  it("buildApplyTransition stops the timer after the apply seconds (clamped)", () => {
    expect(buildApplyTransition(TASK, 600, 1_000)).toMatchObject({
      kind: "stop",
      reason: "apply",
      fireAt: 1_000 + 600_000,
    });
    expect(buildApplyTransition(TASK, -5, 1_000).fireAt).toBe(1_000);
  });
});

describe("scheduler — reconcileWithTimer", () => {
  const NOW = 10_000; // well past the 5s grace window (createdAt = 0)

  it("keeps when there is no schedule", () => {
    expect(reconcileWithTimer(null, null, NOW).action).toBe("keep");
  });

  it("keeps inside the grace window even on a mismatch", () => {
    const t = sched({ createdAt: NOW - 1_000 });
    expect(reconcileWithTimer(t, timer(true, "other"), NOW).action).toBe("keep");
  });

  it("break: keeps while idle, resolves if target already runs, cancels on another task", () => {
    const brk = sched({ kind: "start", reason: "break" });
    expect(reconcileWithTimer(brk, timer(false, null), NOW).action).toBe("keep");
    expect(reconcileWithTimer(brk, timer(true, "t1"), NOW).action).toBe("resolve");
    expect(reconcileWithTimer(brk, timer(true, "other"), NOW).action).toBe("cancel");
  });

  it("apply: keeps while its timer runs, resolves once stopped, cancels on another task", () => {
    const app = sched({ kind: "stop", reason: "apply" });
    expect(reconcileWithTimer(app, timer(true, "t1"), NOW).action).toBe("keep");
    expect(reconcileWithTimer(app, timer(false, null), NOW).action).toBe("resolve");
    expect(reconcileWithTimer(app, timer(true, "other"), NOW).action).toBe("cancel");
  });
});

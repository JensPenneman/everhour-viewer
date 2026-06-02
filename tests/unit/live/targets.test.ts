import { describe, it, expect } from "vitest";
import {
  DAY_TARGET_SECONDS,
  WEEK_TARGET_SECONDS,
  targetProgress,
} from "@/features/live/lib/targets";

describe("targets", () => {
  it("uses 8u / 40u defaults", () => {
    expect(DAY_TARGET_SECONDS).toBe(8 * 3600);
    expect(WEEK_TARGET_SECONDS).toBe(40 * 3600);
  });

  it("reports remaining time below target", () => {
    const p = targetProgress(5 * 3600, DAY_TARGET_SECONDS);
    expect(p.remainingSec).toBe(3 * 3600);
    expect(p.overSec).toBe(0);
    expect(p.reached).toBe(false);
    expect(p.pct).toBe(63); // round(5/8*100)
  });

  it("reports overtime once the target is reached", () => {
    const p = targetProgress(9 * 3600, DAY_TARGET_SECONDS);
    expect(p.remainingSec).toBe(0);
    expect(p.overSec).toBe(3600);
    expect(p.reached).toBe(true);
    expect(p.pct).toBe(100); // capped
  });

  it("treats exactly-on-target as reached with no remaining", () => {
    const p = targetProgress(WEEK_TARGET_SECONDS, WEEK_TARGET_SECONDS);
    expect(p.reached).toBe(true);
    expect(p.remainingSec).toBe(0);
    expect(p.overSec).toBe(0);
    expect(p.pct).toBe(100);
  });

  it("clamps negative tracked input to zero", () => {
    const p = targetProgress(-100, DAY_TARGET_SECONDS);
    expect(p.trackedSec).toBe(0);
    expect(p.remainingSec).toBe(DAY_TARGET_SECONDS);
  });
});

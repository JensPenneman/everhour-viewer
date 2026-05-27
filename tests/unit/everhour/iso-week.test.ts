import { describe, it, expect } from "vitest";
import { isoWeekLabel } from "@/lib/everhour/iso-week";

describe("isoWeekLabel", () => {
  it("labels a mid-year Monday", () => {
    expect(isoWeekLabel("2026-05-18")).toBe("2026-W21");
  });

  it("labels the same week regardless of which weekday is given", () => {
    expect(isoWeekLabel("2026-05-18")).toBe(isoWeekLabel("2026-05-22"));
    expect(isoWeekLabel("2026-05-18")).toBe(isoWeekLabel("2026-05-24"));
  });

  it("places January's first Thursday into week 1 of the year", () => {
    // 2026-01-01 is a Thursday, so it sits in week 1.
    expect(isoWeekLabel("2026-01-01")).toBe("2026-W01");
  });

  it("rolls late-December days into the next year's W01 when appropriate", () => {
    // 2024-12-30 (Monday) is in ISO week 2025-W01 — the week's Thursday is 2025-01-02.
    expect(isoWeekLabel("2024-12-30")).toBe("2025-W01");
  });

  it("zero-pads single-digit weeks", () => {
    const label = isoWeekLabel("2026-01-05"); // week 2
    expect(label).toMatch(/^2026-W0\d$/);
    expect(label).toBe("2026-W02");
  });

  it("handles years whose first Jan day is a Sunday (week 1 starts the next Monday)", () => {
    // 2023-01-01 is a Sunday; its ISO week is 2022-W52.
    expect(isoWeekLabel("2023-01-01")).toBe("2022-W52");
    // 2023-01-02 (Monday) starts ISO week 2023-W01.
    expect(isoWeekLabel("2023-01-02")).toBe("2023-W01");
  });

  it("handles years with 53 ISO weeks", () => {
    // 2020 has 53 ISO weeks because Jan 1 is a Wednesday in a leap year.
    expect(isoWeekLabel("2020-12-28")).toBe("2020-W53");
    expect(isoWeekLabel("2020-12-31")).toBe("2020-W53");
    expect(isoWeekLabel("2021-01-01")).toBe("2020-W53");
  });

  it("survives the leap day of a leap year", () => {
    // 2024-02-29 (Thursday) sits in week 9.
    expect(isoWeekLabel("2024-02-29")).toBe("2024-W09");
  });

  it("treats the year-boundary Thursday rule consistently", () => {
    // 2025-12-29 (Monday) → its Thursday is 2026-01-01 → week 2026-W01.
    expect(isoWeekLabel("2025-12-29")).toBe("2026-W01");
    // 2026-12-31 (Thursday) — that's a Thursday in a 53-week year? Verify it ends up in W53.
    expect(isoWeekLabel("2026-12-31")).toBe("2026-W53");
  });
});

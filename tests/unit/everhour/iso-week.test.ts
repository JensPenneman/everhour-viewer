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
});

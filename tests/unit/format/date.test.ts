import { describe, it, expect } from "vitest";
import { fmtDateFull, fmtDateShort, parseLocalDate, toLocalIsoDate } from "@/lib/format/date";

describe("date helpers", () => {
  it("formats short Dutch dates", () => {
    expect(fmtDateShort("2026-05-18")).toBe("18 mei");
    expect(fmtDateShort("2026-01-01")).toBe("01 jan");
    expect(fmtDateShort("2026-12-31")).toBe("31 dec");
  });

  it("formats full Dutch dates", () => {
    expect(fmtDateFull("2026-05-18")).toBe("18 mei 2026");
  });

  it("parses ISO strings into local-midnight Dates", () => {
    const d = parseLocalDate("2026-05-18");
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(4);
    expect(d.getDate()).toBe(18);
    expect(d.getHours()).toBe(0);
  });

  it("round-trips through toLocalIsoDate", () => {
    const d = parseLocalDate("2026-05-18");
    expect(toLocalIsoDate(d)).toBe("2026-05-18");
  });

  it("pads single-digit months and days", () => {
    expect(toLocalIsoDate(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
});

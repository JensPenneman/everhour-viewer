import { describe, it, expect } from "vitest";
import { fmtHours, totalHours } from "@/lib/format/time";

describe("time helpers", () => {
  it("formats hours with two decimals", () => {
    expect(fmtHours(3600)).toBe("1.00");
    expect(fmtHours(5400)).toBe("1.50");
    expect(fmtHours(3700)).toBe("1.03");
  });

  it("formats zero seconds", () => {
    expect(fmtHours(0)).toBe("0.00");
  });

  it("sums and rounds total hours to two decimals", () => {
    expect(totalHours([3600, 3600, 3600])).toBe(3);
    expect(totalHours([3700, 3700])).toBe(2.06);
    expect(totalHours([])).toBe(0);
  });
});

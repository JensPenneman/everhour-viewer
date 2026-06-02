import { describe, it, expect } from "vitest";
import {
  fmtDuration,
  fmtHours,
  fmtLocalTime,
  fmtSignedHours,
  fmtSignedMinutes,
  localIsoDate,
  localMinutesOfDay,
  totalHours,
} from "@/lib/format/time";

const MINUS = "−"; // U+2212, not a hyphen

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

describe("fmtDuration", () => {
  it("formats sub-hour durations as minutes", () => {
    expect(fmtDuration(2880)).toBe("48m");
    expect(fmtDuration(0)).toBe("0m");
  });

  it("formats whole hours without a minute part", () => {
    expect(fmtDuration(3600)).toBe("1u");
    expect(fmtDuration(7200)).toBe("2u");
  });

  it("formats mixed hours and minutes", () => {
    expect(fmtDuration(4500)).toBe("1u 15m");
    expect(fmtDuration(8220)).toBe("2u 17m");
  });

  it("uses magnitude for negative input", () => {
    expect(fmtDuration(-1620)).toBe("27m");
  });
});

describe("fmtSignedMinutes", () => {
  it("renders a real minus for reductions", () => {
    expect(fmtSignedMinutes(-1620)).toBe(`${MINUS}27 min`);
  });

  it("renders a plus for additions", () => {
    expect(fmtSignedMinutes(2280)).toBe("+38 min");
  });

  it("renders an em dash for no change", () => {
    expect(fmtSignedMinutes(0)).toBe("—");
  });
});

describe("fmtSignedHours", () => {
  it("renders signed two-decimal hours", () => {
    expect(fmtSignedHours(1620)).toBe("+0.45u");
    expect(fmtSignedHours(-1620)).toBe(`${MINUS}0.45u`);
    expect(fmtSignedHours(0)).toBe("—");
  });
});

describe("fmtLocalTime", () => {
  it("applies a positive timezone offset to a UTC timestamp", () => {
    // 14:53 UTC at +2 → 16:53 local
    expect(fmtLocalTime("2026-06-01 14:53:48", 2)).toBe("16:53");
  });

  it("rolls over midnight when the offset crosses a day boundary", () => {
    expect(fmtLocalTime("2026-06-01 23:30:00", 2)).toBe("01:30");
  });

  it("falls back to raw UTC when the offset is unknown", () => {
    expect(fmtLocalTime("2026-06-01 14:53:48", null)).toBe("14:53");
  });

  it("returns an empty string for unparseable input", () => {
    expect(fmtLocalTime("", 2)).toBe("");
    expect(fmtLocalTime("not-a-date", 2)).toBe("");
  });
});

describe("localMinutesOfDay", () => {
  it("returns local minutes-since-midnight", () => {
    expect(localMinutesOfDay("2026-06-01 07:09:00", 2)).toBe(9 * 60 + 9);
  });

  it("returns null for unparseable input", () => {
    expect(localMinutesOfDay("nope", 2)).toBeNull();
  });
});

describe("localIsoDate", () => {
  it("returns the local calendar date after applying the offset", () => {
    expect(localIsoDate("2026-06-01 14:53:48", 2)).toBe("2026-06-01");
  });

  it("rolls forward across midnight (late-evening UTC edit is next local day)", () => {
    // 22:30 UTC at +2 → 00:30 local on 23 jun — must not read as 22 jun.
    expect(localIsoDate("2026-06-22 22:30:00", 2)).toBe("2026-06-23");
  });

  it("rolls backward across midnight (early UTC edit is previous local day at -5)", () => {
    expect(localIsoDate("2026-06-22 02:00:00", -5)).toBe("2026-06-21");
  });

  it("returns null for unparseable input", () => {
    expect(localIsoDate("nope", 2)).toBeNull();
  });
});

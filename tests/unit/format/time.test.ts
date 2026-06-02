import { describe, it, expect } from "vitest";
import {
  fmtDuration,
  fmtLocalTime,
  fmtSignedDuration,
  localIsoDate,
  localMinutesOfDay,
} from "@/lib/format/time";

const MINUS = "−"; // U+2212, not a hyphen

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

  it("rounds to whole minutes", () => {
    expect(fmtDuration(2700)).toBe("45m"); // 0.75u, never "0.75u"
    expect(fmtDuration(37_932)).toBe("10u 32m"); // a real weekly total
  });

  it("uses magnitude for negative input", () => {
    expect(fmtDuration(-1620)).toBe("27m");
  });
});

describe("fmtSignedDuration", () => {
  it("renders a real minus for reductions", () => {
    expect(fmtSignedDuration(-1620)).toBe(`${MINUS}27m`);
    expect(fmtSignedDuration(-4500)).toBe(`${MINUS}1u 15m`);
  });

  it("renders a plus for additions", () => {
    expect(fmtSignedDuration(2280)).toBe("+38m");
    expect(fmtSignedDuration(4500)).toBe("+1u 15m");
  });

  it("renders an em dash for no change", () => {
    expect(fmtSignedDuration(0)).toBe("—");
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

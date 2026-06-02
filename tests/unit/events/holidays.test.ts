import { describe, it, expect } from "vitest";
import { holidaysInRange } from "@/lib/events/holidays";

describe("holidaysInRange (BE / nl)", () => {
  it("includes the New Year and Christmas in a year-wide range", () => {
    const events = holidaysInRange("2026-01-01", "2026-12-31", { country: "BE", language: "nl" });
    expect(events.some((e) => e.date === "2026-01-01")).toBe(true);
    expect(events.some((e) => e.date === "2026-12-25")).toBe(true);
  });

  it("filters to the requested window", () => {
    const events = holidaysInRange("2026-04-01", "2026-04-30", { country: "BE", language: "nl" });
    expect(events.every((e) => e.date >= "2026-04-01" && e.date <= "2026-04-30")).toBe(true);
  });

  it("tags events with the `holidays:be` source and `holiday` kind", () => {
    const events = holidaysInRange("2026-01-01", "2026-01-01", { country: "BE", language: "nl" });
    const newYear = events.find((e) => e.date === "2026-01-01");
    expect(newYear?.source).toBe("holidays:be");
    expect(newYear?.kind).toBe("holiday");
    expect(typeof newYear?.label).toBe("string");
    expect(newYear?.label.length).toBeGreaterThan(0);
  });

  it("spans across calendar years", () => {
    const events = holidaysInRange("2025-12-20", "2026-01-10", { country: "BE", language: "nl" });
    expect(events.some((e) => e.date.startsWith("2025"))).toBe(true);
    expect(events.some((e) => e.date.startsWith("2026"))).toBe(true);
  });

  it("produces deterministic ids", () => {
    const a = holidaysInRange("2026-01-01", "2026-12-31", { country: "BE", language: "nl" });
    const b = holidaysInRange("2026-01-01", "2026-12-31", { country: "BE", language: "nl" });
    expect(a.map((e) => e.id)).toEqual(b.map((e) => e.id));
  });

  it("returns an empty array for invalid input", () => {
    expect(holidaysInRange("not-a-date", "2026-01-01", { country: "BE" })).toEqual([]);
    expect(holidaysInRange("2026-01-01", "also-not-a-date", { country: "BE" })).toEqual([]);
  });

  it("returns the ten Belgian public holidays for a full year", () => {
    const events = holidaysInRange("2026-01-01", "2026-12-31", { country: "BE", language: "nl" });
    expect(events).toHaveLength(10);
  });

  it("computes the Easter-relative holidays (2026: Easter is 5 Apr)", () => {
    const events = holidaysInRange("2026-01-01", "2026-12-31", { country: "BE", language: "nl" });
    const dates = new Set(events.map((e) => e.date));
    expect(dates.has("2026-04-06")).toBe(true); // Paasmaandag (Easter + 1)
    expect(dates.has("2026-05-14")).toBe(true); // O.L.H.-Hemelvaart (Easter + 39)
    expect(dates.has("2026-05-25")).toBe(true); // Pinkstermaandag (Easter + 50)
  });

  it("ignores non-Belgian country codes", () => {
    expect(holidaysInRange("2026-01-01", "2026-12-31", { country: "NL" })).toEqual([]);
  });
});

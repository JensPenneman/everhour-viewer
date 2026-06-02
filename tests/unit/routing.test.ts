import { describe, it, expect } from "vitest";
import { dayHref, parseRoute, routeDepth, weekHref } from "@/lib/routing";

describe("parseRoute", () => {
  it("maps the root to home", () => {
    expect(parseRoute("/")).toEqual({ view: "home" });
    expect(parseRoute("")).toEqual({ view: "home" });
  });

  it("maps /profile to the profile view", () => {
    expect(parseRoute("/profile")).toEqual({ view: "profile" });
  });

  it("maps a week path", () => {
    expect(parseRoute("/week/2026-W23")).toEqual({
      view: "week",
      isoWeek: "2026-W23",
      date: null,
    });
  });

  it("maps a day path within a week", () => {
    expect(parseRoute("/week/2026-W23/2026-06-01")).toEqual({
      view: "week",
      isoWeek: "2026-W23",
      date: "2026-06-01",
    });
  });

  it("tolerates a trailing slash", () => {
    expect(parseRoute("/week/2026-W23/")).toEqual({
      view: "week",
      isoWeek: "2026-W23",
      date: null,
    });
  });

  it("falls back to home for a malformed iso week", () => {
    expect(parseRoute("/week/not-a-week")).toEqual({ view: "home" });
  });

  it("drops a malformed date segment rather than failing", () => {
    expect(parseRoute("/week/2026-W23/garbage")).toEqual({
      view: "week",
      isoWeek: "2026-W23",
      date: null,
    });
  });

  it("falls back to home for unknown roots", () => {
    expect(parseRoute("/anything/else")).toEqual({ view: "home" });
  });
});

describe("routeDepth", () => {
  it("orders home < week|profile < day for direction-aware transitions", () => {
    expect(routeDepth(parseRoute("/"))).toBe(0);
    expect(routeDepth(parseRoute("/profile"))).toBe(1);
    expect(routeDepth(parseRoute("/week/2026-W23"))).toBe(1);
    expect(routeDepth(parseRoute("/week/2026-W23/2026-06-01"))).toBe(2);
  });

  it("yields a positive delta forward (week → day) and negative back (day → week)", () => {
    const week = routeDepth(parseRoute("/week/2026-W23"));
    const day = routeDepth(parseRoute("/week/2026-W23/2026-06-01"));
    expect(day - week).toBeGreaterThan(0);
    expect(week - day).toBeLessThan(0);
  });
});

describe("href builders", () => {
  it("round-trips through parseRoute", () => {
    expect(parseRoute(weekHref("2026-W23"))).toEqual({
      view: "week",
      isoWeek: "2026-W23",
      date: null,
    });
    expect(parseRoute(dayHref("2026-W23", "2026-06-01"))).toEqual({
      view: "week",
      isoWeek: "2026-W23",
      date: "2026-06-01",
    });
  });
});

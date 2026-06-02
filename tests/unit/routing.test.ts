import { describe, it, expect } from "vitest";
import { dayHref, parseRoute, weekHref } from "@/lib/routing";

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

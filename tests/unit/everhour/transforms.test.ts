import { describe, it, expect } from "vitest";
import { buildWeek, sanitizeProfile } from "@/lib/everhour/transforms";
import type { RawEntry, RawTimesheet } from "@/lib/everhour/types";

function makeTimesheet(overrides: Partial<RawTimesheet> = {}): RawTimesheet {
  return {
    user: { id: 1, name: "Tester", email: "t@example.com" },
    week: { id: 2520, from: "2026-05-18", to: "2026-05-24" },
    ...overrides,
  };
}

function makeEntry(date: string, seconds: number, taskId = "li:abc"): RawEntry {
  return {
    date,
    time: seconds,
    task: {
      id: taskId,
      name: "Test task",
      number: "LS-1",
      url: "https://linear.app/x/issue/LS-1",
      labels: [],
    },
    lockReasons: [],
  };
}

describe("buildWeek", () => {
  it("groups entries by date and aggregates totals", () => {
    const ts = makeTimesheet();
    const week = buildWeek(ts, [
      makeEntry("2026-05-18", 3600),
      makeEntry("2026-05-18", 1800, "li:other"),
      makeEntry("2026-05-19", 7200),
    ]);

    expect(week.days).toHaveLength(2);
    const monday = week.days.find((d) => d.date === "2026-05-18");
    expect(monday?.totalSeconds).toBe(5400);
    expect(monday?.entries).toHaveLength(2);
    expect(week.totals.seconds).toBe(12_600);
    expect(week.totals.hours).toBe(3.5);
  });

  it("sorts entries within a day by descending duration", () => {
    const week = buildWeek(makeTimesheet(), [
      makeEntry("2026-05-18", 1800, "li:a"),
      makeEntry("2026-05-18", 7200, "li:b"),
      makeEntry("2026-05-18", 3600, "li:c"),
    ]);
    const day = week.days[0];
    expect(day?.entries.map((e) => e.seconds)).toEqual([7200, 3600, 1800]);
  });

  it("merges in timecards for days that have no entries", () => {
    const ts = makeTimesheet({
      timecards: [{ date: "2026-05-20", clockIn: "09:00", clockOut: "17:00", workTime: 28_800 }],
    });
    const week = buildWeek(ts, []);
    const day = week.days.find((d) => d.date === "2026-05-20");
    expect(day?.clockIn).toBe("09:00");
    expect(day?.totalSeconds).toBe(0);
    expect(day?.entries).toHaveLength(0);
  });

  it("derives approval status and submittedAt from history", () => {
    const ts = makeTimesheet({
      approval: {
        status: "pending",
        history: [
          { action: "created", createdAt: "2026-05-24 09:00" },
          { action: "submitted", createdAt: "2026-05-24 17:30" },
        ],
      },
    });
    const week = buildWeek(ts, []);
    expect(week.approval.status).toBe("pending");
    expect(week.approval.submittedAt).toBe("2026-05-24 17:30");
  });

  it("defaults to unsubmitted when no approval is present", () => {
    const week = buildWeek(makeTimesheet(), []);
    expect(week.approval.status).toBe("unsubmitted");
    expect(week.approval.submittedAt).toBeNull();
  });

  it("rounds totals.hours to two decimals", () => {
    const week = buildWeek(makeTimesheet(), [makeEntry("2026-05-18", 3700)]);
    expect(week.totals.hours).toBe(1.03);
  });
});

describe("sanitizeProfile", () => {
  it("projects allow-listed fields", () => {
    const raw = {
      id: 42,
      name: "Tester",
      email: "t@example.com",
      role: "member",
      headline: "Engineer",
      capacity: 40,
      cost: 0,
      groups: [{ id: 1, name: "Eng" }],
      // fields not on the allow-list
      avatarBlob: "lots of binary",
      secret: "do not persist",
    };
    const profile = sanitizeProfile(raw);
    expect(profile.id).toBe(42);
    expect(profile.role).toBe("member");
    expect(profile.headline).toBe("Engineer");
    expect(profile.groups).toEqual([{ id: 1, name: "Eng" }]);
    expect("avatarBlob" in profile).toBe(false);
    expect("secret" in profile).toBe(false);
  });

  it("defaults missing optional fields to null", () => {
    const profile = sanitizeProfile({ id: 1, name: "X", email: "x@example.com" });
    expect(profile.role).toBeNull();
    expect(profile.avatarUrl).toBeNull();
    expect(profile.timezone).toBeNull();
  });
});

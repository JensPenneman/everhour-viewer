import { describe, it, expect } from "vitest";
import {
  canSubmitWeek,
  statusFromHistory,
  timesheetId,
  withSubmittedApproval,
} from "@/lib/everhour/submit";
import type { ApprovalStatus, WeekRecord } from "@/lib/everhour/types";
import { WEEK_SCHEMA_VERSION } from "@/lib/everhour/types";

function makeWeek(
  status: ApprovalStatus,
  totalSeconds: number,
  overrides: Partial<WeekRecord> = {},
): WeekRecord {
  return {
    schemaVersion: WEEK_SCHEMA_VERSION,
    exportedAt: "2026-06-02T08:00:00",
    user: { id: 14856, name: "Tester", email: "t@example.com" },
    week: { isoWeek: "2025-W35", weekId: 2535, from: "2025-08-25", to: "2025-08-31" },
    approval: { status, submittedAt: null, history: [] },
    totals: { seconds: totalSeconds, hours: totalSeconds / 3600 },
    days: [],
    ...overrides,
  };
}

describe("timesheetId", () => {
  it("concatenates user id and week id (Everhour composite id)", () => {
    expect(timesheetId(14856, 2535)).toBe("148562535");
  });
});

describe("canSubmitWeek", () => {
  it("allows submitting an open week with recorded time", () => {
    expect(canSubmitWeek(makeWeek("unsubmitted", 3600))).toBe(true);
  });

  it("allows re-submitting a rejected week with recorded time", () => {
    expect(canSubmitWeek(makeWeek("rejected", 3600))).toBe(true);
  });

  it("blocks a pending week (already awaiting review)", () => {
    expect(canSubmitWeek(makeWeek("pending", 3600))).toBe(false);
  });

  it("blocks an approved week (closed)", () => {
    expect(canSubmitWeek(makeWeek("approved", 3600))).toBe(false);
  });

  it("blocks an empty week even when open", () => {
    expect(canSubmitWeek(makeWeek("unsubmitted", 0))).toBe(false);
  });
});

describe("statusFromHistory", () => {
  it("maps the newest action to the approval status", () => {
    expect(statusFromHistory([{ action: "submitted", createdAt: "x" }])).toBe("pending");
    expect(statusFromHistory([{ action: "approved", createdAt: "x" }])).toBe("approved");
    expect(statusFromHistory([{ action: "rejected", createdAt: "x" }])).toBe("rejected");
    expect(statusFromHistory([{ action: "discarded", createdAt: "x" }])).toBe("unsubmitted");
  });

  it("uses the latest event when several are present", () => {
    expect(
      statusFromHistory([
        { action: "submitted", createdAt: "1" },
        { action: "rejected", createdAt: "2" },
        { action: "submitted", createdAt: "3" },
      ]),
    ).toBe("pending");
  });

  it("falls back when history is empty or unknown", () => {
    expect(statusFromHistory([])).toBe("unsubmitted");
    expect(statusFromHistory([], "pending")).toBe("pending");
    expect(statusFromHistory([{ action: "weird", createdAt: "x" }], "pending")).toBe("pending");
  });
});

describe("withSubmittedApproval", () => {
  it("flips status to pending, sets submittedAt, and appends a submitted event", () => {
    const week = makeWeek("unsubmitted", 3600);
    const next = withSubmittedApproval(week, "2026-06-04 09:00:00");

    expect(next.approval.status).toBe("pending");
    expect(next.approval.submittedAt).toBe("2026-06-04 09:00:00");
    expect(next.approval.history).toHaveLength(1);
    expect(next.approval.history.at(-1)).toEqual({
      action: "submitted",
      createdAt: "2026-06-04 09:00:00",
    });
  });

  it("preserves prior history and does not mutate the input", () => {
    const week = makeWeek("rejected", 3600, {
      approval: {
        status: "rejected",
        submittedAt: null,
        history: [{ action: "rejected", createdAt: "2026-06-01 10:00:00" }],
      },
    });
    const next = withSubmittedApproval(week, "2026-06-04 09:00:00");

    expect(next.approval.history).toHaveLength(2);
    expect(next.approval.history[0]).toEqual({
      action: "rejected",
      createdAt: "2026-06-01 10:00:00",
    });
    // input untouched
    expect(week.approval.status).toBe("rejected");
    expect(week.approval.history).toHaveLength(1);
  });
});

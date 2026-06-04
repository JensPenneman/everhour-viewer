import { format, parseISO } from "date-fns";
import type { ApprovalStatus, EverhourProfile, Timer, WeekRecord } from "@/lib/everhour/types";

/**
 * Canonical fixtures for the e2e suite — one source of truth for the mocked
 * Everhour data every spec streams over `/api/sync` and tRPC. Keeping the
 * shapes here (typed against the real domain types) means a schema change
 * surfaces as a type error in one place instead of drifting per spec.
 */

/** The (mocked) "today" all live fixtures are anchored to. */
export const TEST_TODAY = "2026-06-02";

/** The single task every fixture timer / week entry runs on. */
export const MOCK_TASK = {
  id: "li:test",
  name: "Mock task",
  linearKey: "LS-1",
  url: null,
} as const;

/** A synced profile. Override any field per spec. */
export function testProfile(overrides: Partial<EverhourProfile> = {}): EverhourProfile {
  return {
    schemaVersion: 1,
    exportedAt: "2026-06-02T08:00:00",
    id: 1,
    name: "Test User",
    email: "test@example.com",
    role: "member",
    headline: "Engineer",
    status: "active",
    avatarUrl: null,
    avatarUrlLarge: null,
    timezone: 0,
    capacity: 40,
    cost: 0,
    costHistory: null,
    createdAt: "2025-01-01",
    groups: [],
    ...overrides,
  };
}

export interface MakeWeekOptions {
  readonly isoWeek?: string;
  readonly weekId?: number;
  readonly from?: string;
  readonly to?: string;
  readonly status?: ApprovalStatus;
  readonly seconds?: number;
  /** Set false for an empty week (no day entries) — e.g. a delta-sync stub. */
  readonly withEntry?: boolean;
}

/** A {@link WeekRecord} as the streaming sync emits it. Defaults to W23, open. */
export function makeWeek(opts: MakeWeekOptions = {}): WeekRecord {
  const {
    isoWeek = "2026-W23",
    weekId = 2623,
    from = "2026-06-01",
    to = "2026-06-07",
    status = "unsubmitted",
    seconds = 3600,
    withEntry = true,
  } = opts;
  return {
    schemaVersion: 3,
    exportedAt: "2026-06-02T08:00:00",
    user: { id: 1, name: "Test User", email: "test@example.com" },
    week: { isoWeek, weekId, from, to },
    approval: { status, submittedAt: null, history: [] },
    totals: { seconds, hours: Math.round((seconds / 3600) * 100) / 100 },
    days: withEntry
      ? [
          {
            date: from,
            // Match what the real sync emits (transforms.ts uses date-fns EEEE),
            // so a fixture with a custom `from` stays self-consistent.
            weekday: format(parseISO(from), "EEEE"),
            totalSeconds: seconds,
            entries: [{ task: { ...MOCK_TASK, labels: [] }, seconds, lockReasons: [] }],
          },
        ]
      : [],
  };
}

export const idleTimer: Timer = { running: false, durationSeconds: 0, startedAt: null, task: null };

export const runningTimer: Timer = {
  running: true,
  durationSeconds: 0,
  startedAt: "2026-06-02 09:00:00",
  task: { ...MOCK_TASK, status: "Active" },
};

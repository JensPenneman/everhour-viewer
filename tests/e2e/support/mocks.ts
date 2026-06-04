import { type Page } from "@playwright/test";
import type { WeekRecord } from "@/lib/everhour/types";
import { idleTimer, makeWeek, runningTimer, TEST_TODAY, testProfile } from "./fixtures";
import { mockTrpc, type TrpcHandler } from "./trpc";

/**
 * Network mocking for the e2e suite: a deterministic `/api/sync` NDJSON stream
 * and the live tRPC procedures, so specs never touch the real Everhour API.
 */

/** The default live tRPC handlers — env key present, idle timer, empty data. */
function baseHandlers(): Record<string, TrpcHandler> {
  return {
    "system.capabilities": () => ({ hasEnvKey: true }),
    "timer.current": () => idleTimer,
    "clock.today": () => ({ date: TEST_TODAY, clockedIn: false, clockIn: null, clockOut: null }),
    "clock.set": () => ({ ok: true }),
    "time.range": () => [],
    "tasks.search": () => [],
  };
}

/** Mock the live tRPC procedures (idle defaults), with optional per-spec overrides. */
export function mockLive(page: Page, overrides: Record<string, TrpcHandler> = {}): Promise<void> {
  return mockTrpc(page, { ...baseHandlers(), ...overrides });
}

/**
 * Mock the live tRPC procedures with a start/stop-able timer: `timer.start` /
 * `timer.stop` flip internal state that `timer.current` reflects, so the polled
 * query mirrors what the UI just did.
 */
export function mockLiveTimer(
  page: Page,
  opts: { startRunning?: boolean; overrides?: Record<string, TrpcHandler> } = {},
): Promise<void> {
  let running = opts.startRunning ?? false;
  return mockTrpc(page, {
    ...baseHandlers(),
    "timer.current": () => (running ? runningTimer : idleTimer),
    "timer.start": () => {
      running = true;
      return runningTimer;
    },
    "timer.stop": () => {
      running = false;
      return idleTimer;
    },
    ...opts.overrides,
  });
}

export interface SyncCounts {
  new: number;
  updated: number;
  skipped: number;
  totalWeeks: number;
}

export interface MockSyncOptions {
  /** Weeks to stream: an explicit list, or a count to auto-generate (2026-W20, W19, …). */
  readonly weeks: ReadonlyArray<WeekRecord> | number;
  readonly counts?: SyncCounts;
  /** Inspect the sync request body (for delta-sync `knownWeeks` assertions). */
  readonly capture?: (body: unknown) => void;
}

function resolveWeeks(weeks: MockSyncOptions["weeks"]): ReadonlyArray<WeekRecord> {
  if (Array.isArray(weeks)) return weeks;
  return Array.from({ length: weeks as number }, (_, i) =>
    makeWeek({
      isoWeek: `2026-W${String(20 - i).padStart(2, "0")}`,
      weekId: 2520 - i,
      from: "2026-05-11",
      to: "2026-05-17",
      status: "pending",
      seconds: 28_800,
    }),
  );
}

function ndjson(weeks: ReadonlyArray<WeekRecord>, counts: SyncCounts): string {
  const lines = [
    JSON.stringify({ type: "profile", profile: testProfile() }),
    JSON.stringify({ type: "plan", total: weeks.length, toFetch: weeks.length, toSkip: 0 }),
    ...weeks.map((week, i) =>
      JSON.stringify({ type: "week", current: i + 1, total: weeks.length, kind: "new", week }),
    ),
    JSON.stringify({ type: "done", counts }),
  ];
  return lines.join("\n") + "\n";
}

/** Install a deterministic NDJSON `/api/sync` route. */
export async function mockSync(page: Page, opts: MockSyncOptions): Promise<void> {
  const weeks = resolveWeeks(opts.weeks);
  const counts = opts.counts ?? {
    new: weeks.length,
    updated: 0,
    skipped: 0,
    totalWeeks: weeks.length,
  };
  await page.route("**/api/sync", async (route) => {
    opts.capture?.(route.request().postDataJSON());
    await route.fulfill({
      status: 200,
      headers: { "Content-Type": "application/x-ndjson" },
      body: ndjson(weeks, counts),
    });
  });
}

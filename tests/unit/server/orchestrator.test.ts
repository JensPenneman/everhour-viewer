import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runSync } from "@/server/sync/orchestrator";
import type { SyncEvent, SyncRequest } from "@/server/sync";
import { readNdjsonStream } from "@/lib/streaming/ndjson";

/**
 * The orchestrator composes `fetchProfile`, `fetchTimesheetList` and
 * `fetchWeekEntries`. All three end up calling `global.fetch` via
 * `lib/everhour/client.ts`. We patch `fetch` per-test to feed deterministic
 * responses and assert on the emitted NDJSON event sequence.
 */

interface MockEndpoint {
  readonly matcher: (url: string) => boolean;
  readonly respond: (url: string) => Response | Promise<Response>;
}

function ok(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function err(status: number, body: string = ""): Response {
  return new Response(body, { status });
}

function installFetch(endpoints: ReadonlyArray<MockEndpoint>): void {
  vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    for (const e of endpoints) {
      if (e.matcher(url)) return e.respond(url);
    }
    throw new Error(`No mock endpoint matched: ${url}`);
  });
}

async function collect(stream: ReadableStream<Uint8Array>): Promise<SyncEvent[]> {
  const events: SyncEvent[] = [];
  await readNdjsonStream<SyncEvent>(stream, (e) => {
    events.push(e);
  });
  return events;
}

const PROFILE = {
  id: 42,
  name: "Tester",
  email: "t@example.com",
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
};

const W21_TS = {
  user: { id: 42, name: "Tester", email: "t@example.com" },
  week: { id: 2521, from: "2026-05-18", to: "2026-05-24" },
  dailyTime: { "2026-05-18": 28_800 },
  approval: { status: "pending", history: [] },
};

const W20_TS = {
  user: { id: 42, name: "Tester", email: "t@example.com" },
  week: { id: 2520, from: "2026-05-11", to: "2026-05-17" },
  dailyTime: { "2026-05-11": 28_800 },
  approval: { status: "approved", history: [] },
};

beforeEach(() => {
  vi.restoreAllMocks();
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("runSync — happy path", () => {
  it("emits profile → plan → skip/week → done in order", async () => {
    installFetch([
      { matcher: (u) => u.endsWith("/users/me"), respond: () => ok(PROFILE) },
      {
        matcher: (u) => u.includes("/users/42/timesheets"),
        respond: () => ok([W20_TS, W21_TS]),
      },
      {
        matcher: (u) => u.includes("/users/42/time"),
        respond: () => ok([]),
      },
    ]);

    const events = await collect(
      runSync({
        key: "fake",
        request: {
          weeksBack: 78,
          force: false,
          knownWeeks: [{ isoWeek: "2026-W20", status: "approved" }],
        },
      }),
    );

    const types = events.map((e) => e.type);
    expect(types[0]).toBe("profile");
    expect(types[1]).toBe("plan");
    expect(types).toContain("skip");
    expect(types).toContain("week");
    expect(types.at(-1)).toBe("done");

    const plan = events.find((e) => e.type === "plan");
    expect(plan).toMatchObject({ total: 2, toFetch: 1, toSkip: 1 });

    const skip = events.find((e) => e.type === "skip");
    expect(skip).toMatchObject({ isoWeek: "2026-W20" });

    const week = events.find((e) => e.type === "week");
    expect(week?.type).toBe("week");
    if (week?.type === "week") {
      expect(week.week.week.isoWeek).toBe("2026-W21");
      expect(week.kind).toBe("new");
    }

    const done = events.at(-1);
    expect(done?.type).toBe("done");
    if (done?.type === "done") {
      expect(done.counts).toEqual({ new: 1, updated: 0, skipped: 1, totalWeeks: 2 });
    }
  });

  it("force=true re-fetches a submitted, already-known week as 'updated'", async () => {
    installFetch([
      { matcher: (u) => u.endsWith("/users/me"), respond: () => ok(PROFILE) },
      {
        matcher: (u) => u.includes("/users/42/timesheets"),
        respond: () => ok([W20_TS]),
      },
      {
        matcher: (u) => u.includes("/users/42/time"),
        respond: () => ok([]),
      },
    ]);

    const events = await collect(
      runSync({
        key: "fake",
        request: {
          weeksBack: 78,
          force: true,
          knownWeeks: [{ isoWeek: "2026-W20", status: "approved" }],
        },
      }),
    );

    const week = events.find((e) => e.type === "week");
    expect(week?.type).toBe("week");
    if (week?.type === "week") expect(week.kind).toBe("updated");

    const done = events.at(-1);
    if (done?.type === "done") {
      expect(done.counts).toEqual({ new: 0, updated: 1, skipped: 0, totalWeeks: 1 });
    }
  });
});

describe("runSync — error paths", () => {
  it("emits an error event when the profile fetch returns 401", async () => {
    installFetch([
      { matcher: (u) => u.endsWith("/users/me"), respond: () => err(401, "Unauthorized") },
    ]);

    const events = await collect(runSync({ key: "fake", request: emptyRequest() }));

    expect(events).toHaveLength(1);
    expect(events[0]?.type).toBe("error");
    if (events[0]?.type === "error") {
      expect(events[0].status).toBe(401);
      expect(events[0].message).toMatch(/401/);
    }
  });

  it("retries 5xx and then surfaces the failure as an error event", async () => {
    let calls = 0;
    installFetch([
      {
        matcher: (u) => u.endsWith("/users/me"),
        respond: () => {
          calls++;
          return err(503, "Service Unavailable");
        },
      },
    ]);

    const events = await collect(runSync({ key: "fake", request: emptyRequest() }));

    expect(calls).toBeGreaterThan(1); // retried at least once
    expect(events.at(-1)?.type).toBe("error");
    if (events.at(-1)?.type === "error") {
      expect((events.at(-1) as { status?: number }).status).toBe(503);
    }
  });

  it("emits partial profile + error when a mid-stream week fetch fails", async () => {
    installFetch([
      { matcher: (u) => u.endsWith("/users/me"), respond: () => ok(PROFILE) },
      {
        matcher: (u) => u.includes("/users/42/timesheets"),
        respond: () => ok([W21_TS]),
      },
      {
        matcher: (u) => u.includes("/users/42/time"),
        respond: () => err(404, "not found"),
      },
    ]);

    const events = await collect(runSync({ key: "fake", request: emptyRequest() }));

    const types = events.map((e) => e.type);
    expect(types).toEqual(["profile", "plan", "error"]);
    const errorEvent = events.at(-1);
    if (errorEvent?.type === "error") {
      expect(errorEvent.status).toBe(404);
    }
  });
});

function emptyRequest(): SyncRequest {
  return { weeksBack: 78, force: false, knownWeeks: [] };
}

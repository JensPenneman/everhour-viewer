import { expect, test, type Page } from "@playwright/test";

/**
 * Live "Vandaag" timer flow against fully mocked API routes — no real
 * Everhour calls. Drives the core loop: land on Vandaag, start a timer on a
 * recent task, see it running, then stop it.
 */

const PROFILE = {
  schemaVersion: 1,
  exportedAt: "2026-06-02T08:00:00",
  id: 1,
  name: "Test User",
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

const WEEK = {
  schemaVersion: 3,
  exportedAt: "2026-06-02T08:00:00",
  user: { id: 1, name: "Test User", email: "t@example.com" },
  week: { isoWeek: "2026-W23", weekId: 2623, from: "2026-06-01", to: "2026-06-07" },
  approval: { status: "unsubmitted", submittedAt: null, history: [] },
  totals: { seconds: 3600, hours: 1 },
  days: [
    {
      date: "2026-06-01",
      weekday: "Monday",
      totalSeconds: 3600,
      entries: [
        {
          task: { id: "li:test", name: "Mock task", linearKey: "LS-1", url: null, labels: [] },
          seconds: 3600,
          lockReasons: [],
        },
      ],
    },
  ],
};

const RUNNING = {
  running: true,
  durationSeconds: 0,
  startedAt: "2026-06-02 09:00:00",
  task: { id: "li:test", name: "Mock task", linearKey: "LS-1", url: null, status: "Active" },
};
const IDLE = { running: false, durationSeconds: 0, startedAt: null, task: null };

async function installMocks(page: Page): Promise<void> {
  let running = false;

  await page.route("**/api/sync", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({ status: 200, body: JSON.stringify({ hasEnvKey: true }) });
      return;
    }
    const ndjson =
      [
        JSON.stringify({ type: "profile", profile: PROFILE }),
        JSON.stringify({ type: "plan", total: 1, toFetch: 1, toSkip: 0 }),
        JSON.stringify({ type: "week", current: 1, total: 1, kind: "new", week: WEEK }),
        JSON.stringify({ type: "done", counts: { new: 1, updated: 0, skipped: 0, totalWeeks: 1 } }),
      ].join("\n") + "\n";
    await route.fulfill({
      status: 200,
      headers: { "Content-Type": "application/x-ndjson" },
      body: ndjson,
    });
  });

  await page.route("**/api/timer", async (route) => {
    const method = route.request().method();
    if (method === "POST") running = true;
    if (method === "DELETE") running = false;
    await route.fulfill({ status: 200, body: JSON.stringify(running ? RUNNING : IDLE) });
  });

  await page.route("**/api/clock**", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({
          date: "2026-06-02",
          clockedIn: false,
          clockIn: null,
          clockOut: null,
        }),
      });
    } else {
      await route.fulfill({ status: 200, body: JSON.stringify({ ok: true }) });
    }
  });

  // Regex (not a glob) so `/api/time?…` can't also shadow `/api/timer`.
  await page.route(/\/api\/time\?/, (route) => route.fulfill({ status: 200, body: "[]" }));
  await page.route(/\/api\/tasks(\?|$)/, (route) => route.fulfill({ status: 200, body: "[]" }));
}

test.describe("Vandaag — live timer (mocked)", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => window.localStorage.clear());
    await installMocks(page);
  });

  test("starts a timer on a recent task and stops it", async ({ page }) => {
    await page.goto("/");
    // First run → sync to load profile + a recent task, then land on Vandaag.
    await page.getByRole("button", { name: "Synchroniseer", exact: true }).first().click();
    await expect(page.getByRole("heading", { name: "Vandaag" })).toBeVisible({ timeout: 15_000 });

    // Idle to start with.
    await expect(page.getByText("Geen timer loopt")).toBeVisible();

    // Start via the recent-task quick-start chip.
    await page
      .getByRole("button", { name: /Mock task/ })
      .first()
      .click();

    // Running widget shows the task and a Stop control.
    await expect(page.getByText("Loopt nu")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("button", { name: "Stop" })).toBeVisible();

    // Stop returns to idle.
    await page.getByRole("button", { name: "Stop" }).click();
    await expect(page.getByText("Geen timer loopt")).toBeVisible({ timeout: 10_000 });
  });
});

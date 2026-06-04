import { expect, test, type Page } from "@playwright/test";
import { mockTrpc } from "./_trpc";

/**
 * The scheduled-timer-transition engine (Pauze + Gespaarde minuten), end to
 * end against mocked tRPC. Real break/apply durations are minutes long, so we
 * seed a near-due schedule into localStorage (via addInitScript) and assert the
 * engine fires it — auto-resuming a break, and auto-stopping an apply.
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

async function installMocks(page: Page, startRunning: boolean): Promise<void> {
  let running = startRunning;

  await page.route("**/api/sync", async (route) => {
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

  await mockTrpc(page, {
    "system.capabilities": () => ({ hasEnvKey: true }),
    "timer.current": () => (running ? RUNNING : IDLE),
    "timer.start": () => {
      running = true;
      return RUNNING;
    },
    "timer.stop": () => {
      running = false;
      return IDLE;
    },
    "clock.today": () => ({ date: "2026-06-02", clockedIn: false, clockIn: null, clockOut: null }),
    "clock.set": () => ({ ok: true }),
    "time.range": () => [],
    "tasks.search": () => [],
  });
}

/**
 * How long after page-load a seeded transition becomes due.
 *
 * `fireAt` is anchored to page-load (the only clock `addInitScript` can read),
 * but the pending banner only mounts once the sync completes and the profile
 * loads — several seconds later under CI. So this delay must comfortably exceed
 * boot + sync, or the schedule comes due and fires (clearing the banner) before
 * it ever renders, and the "pending" assertions miss it. The original 600 ms
 * lost that race in CI. It must also stay well under the post-fire assertion
 * budget below so the auto-fire is still observed in time.
 */
const SCHEDULE_FIRE_DELAY_MS = 6_000;

/** Seed a single pending transition that becomes due a few seconds after load. */
async function seedSchedule(page: Page, kind: "start" | "stop", reason: "break" | "apply") {
  await page.addInitScript(
    ([k, r, delayMs]) => {
      window.localStorage.clear();
      const now = Date.now();
      window.localStorage.setItem(
        "everhour_viewer_timer_schedule_v1",
        JSON.stringify({
          schemaVersion: 1,
          transition: {
            kind: k,
            reason: r,
            task: { id: "li:test", name: "Mock task", linearKey: "LS-1", url: null },
            fireAt: now + delayMs,
            createdAt: now,
          },
        }),
      );
    },
    [kind, reason, SCHEDULE_FIRE_DELAY_MS] as const,
  );
}

async function gotoVandaag(page: Page): Promise<void> {
  await page.goto("/");
  await page.getByRole("button", { name: "Synchroniseer", exact: true }).first().click();
  await expect(page.getByRole("heading", { name: "Vandaag" })).toBeVisible({ timeout: 15_000 });
}

test.describe("Vandaag — scheduled transitions (mocked)", () => {
  test("auto-resumes the timer when a break comes due", async ({ page }) => {
    await seedSchedule(page, "start", "break");
    await installMocks(page, /* startRunning */ false);
    await gotoVandaag(page);

    // The break is pending → resume countdown is shown.
    await expect(page.getByText("Pauze — hervat automatisch")).toBeVisible();

    // The engine fires: the timer starts and the resume toast appears.
    await expect(page.getByText("Loopt nu")).toBeVisible({ timeout: 12_000 });
    await expect(page.getByText(/Timer hervat/)).toBeVisible({ timeout: 12_000 });
  });

  test("auto-stops the apply timer when its booking comes due", async ({ page }) => {
    await seedSchedule(page, "stop", "apply");
    await installMocks(page, /* startRunning */ true);
    await gotoVandaag(page);

    // The apply is pending → the booking banner is shown.
    await expect(page.getByText("Bezig met boeken")).toBeVisible();

    // The engine fires: the timer stops and the booked toast appears.
    await expect(page.getByText("Geen timer loopt")).toBeVisible({ timeout: 12_000 });
    await expect(page.getByText(/geboekt op/)).toBeVisible({ timeout: 12_000 });
  });

  test("shows the running timer in the shell on other routes", async ({ page }) => {
    await page.addInitScript(() => window.localStorage.clear());
    await installMocks(page, /* startRunning */ false);
    await gotoVandaag(page);

    // Start a timer via the recent-task chip → the full hero shows on Vandaag.
    await page
      .getByRole("button", { name: /Mock task/ })
      .first()
      .click();
    await expect(page.getByText("Loopt nu")).toBeVisible({ timeout: 10_000 });

    // Navigate to the week view (client-side, provider stays mounted): the hero
    // is gone but the compact shell strip surfaces the same running timer.
    await page.getByRole("button", { name: /2026-W23/ }).click();
    await expect(page.getByText("Loopt nu")).toBeHidden();
    const strip = page.getByRole("status").filter({ hasText: "Loopt" });
    await expect(strip).toBeVisible({ timeout: 10_000 });
    await expect(strip.getByText(/Mock task/)).toBeVisible();

    // The strip carries the morph tag so it view-transitions from the Vandaag
    // hero. Only assert where the browser supports View Transitions (Chromium).
    const vtName = await strip.evaluate((el) => getComputedStyle(el).viewTransitionName);
    if (vtName && vtName !== "none") expect(vtName).toBe("live-timer");

    // Stop from the shell strip → it disappears.
    await strip.getByRole("button", { name: "Stop" }).click();
    await expect(strip).toBeHidden({ timeout: 10_000 });
  });

  // Real-UI flows (no seeding): these exercise writeSchedule/writeLedgerFile at
  // runtime — the path that a synthetic StorageEvent broke (devtools wiped the
  // freshly-written key). Seed-at-load tests do not cover it.
  test("clicking Pauze stops the timer and shows the auto-resume countdown", async ({ page }) => {
    await page.addInitScript(() => window.localStorage.clear());
    await installMocks(page, /* startRunning */ true);
    await gotoVandaag(page);
    await expect(page.getByText("Loopt nu")).toBeVisible({ timeout: 10_000 });

    await page.getByRole("button", { name: "Pauze" }).first().click();
    await expect(page.getByText("Pauze nemen")).toBeVisible();
    await page.getByRole("button", { name: /Start pauze/ }).click();

    // The schedule must be written and reactively picked up.
    await expect(page.getByText("Pauze — hervat automatisch")).toBeVisible({ timeout: 8_000 });
    await expect(page.getByRole("button", { name: "Hervat nu" })).toBeVisible();
  });

  test("Bijboeken updates the saved-minutes saldo reactively", async ({ page }) => {
    await page.addInitScript(() => window.localStorage.clear());
    await installMocks(page, /* startRunning */ false);
    await gotoVandaag(page);

    await expect(page.getByText("Gespaarde minuten")).toBeVisible();
    await page.getByRole("button", { name: /Bijboeken/ }).click();

    // The ledger write must be reactively reflected in the saldo + an entry row.
    await expect(page.getByText("+15m").first()).toBeVisible({ timeout: 8_000 });

    // …and it must move the day meter: 0 tracked + 15m correction → 7u 45m left,
    // annotated so the correction's impact is visible.
    await expect(page.getByText("Nog 7u 45m")).toBeVisible({ timeout: 8_000 });
    await expect(page.getByText(/incl\./).first()).toBeVisible();
  });
});

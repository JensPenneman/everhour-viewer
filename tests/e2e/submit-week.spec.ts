import { expect, test, type Page } from "@playwright/test";
import { mockTrpc } from "./_trpc";

/**
 * "Week indienen" (submit a week's timesheet for approval), end to end against
 * a mocked /api/sync + tRPC. We sync a single open ("unsubmitted") week with
 * recorded time, open it, and exercise both the success path (status flips to
 * "in afwachting" + success toast) and the failure path (the limited API key
 * is rejected → error toast, status unchanged).
 *
 * The week's status comes from the synced data, so the optimistic update from
 * `timesheet.submit` is what we're really asserting on the success path.
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

const OPEN_WEEK = {
  schemaVersion: 3,
  exportedAt: "2026-06-02T08:00:00",
  user: { id: 1, name: "Test User", email: "t@example.com" },
  week: { isoWeek: "2026-W23", weekId: 2623, from: "2026-06-01", to: "2026-06-07" },
  approval: { status: "unsubmitted", submittedAt: null, history: [] },
  totals: { seconds: 28_800, hours: 8 },
  days: [
    {
      date: "2026-06-01",
      weekday: "Monday",
      totalSeconds: 28_800,
      entries: [
        {
          task: { id: "li:test", name: "Mock task", linearKey: "LS-1", url: null, labels: [] },
          seconds: 28_800,
          lockReasons: [],
        },
      ],
    },
  ],
};

const IDLE_TIMER = { running: false, durationSeconds: 0, startedAt: null, task: null };

async function mockSync(page: Page): Promise<void> {
  await page.route("**/api/sync", async (route) => {
    const ndjson =
      [
        JSON.stringify({ type: "profile", profile: PROFILE }),
        JSON.stringify({ type: "plan", total: 1, toFetch: 1, toSkip: 0 }),
        JSON.stringify({ type: "week", current: 1, total: 1, kind: "new", week: OPEN_WEEK }),
        JSON.stringify({ type: "done", counts: { new: 1, updated: 0, skipped: 0, totalWeeks: 1 } }),
      ].join("\n") + "\n";
    await route.fulfill({
      status: 200,
      headers: { "Content-Type": "application/x-ndjson" },
      body: ndjson,
    });
  });
}

/** Live tRPC mocks so the post-sync shell never hits the real backend. */
const LIVE_HANDLERS = {
  "system.capabilities": () => ({ hasEnvKey: true }),
  "timer.current": () => IDLE_TIMER,
  "clock.today": () => ({ date: "2026-06-02", clockedIn: false, clockIn: null, clockOut: null }),
  "time.range": () => [] as unknown[],
  "tasks.search": () => [] as unknown[],
};

async function openWeek(page: Page): Promise<void> {
  await page.addInitScript(() => window.localStorage.clear());
  await mockSync(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Synchroniseer", exact: true }).first().click();

  const sidebar = page.getByRole("complementary", { name: "Navigatie" });
  await sidebar.getByText("2026-W23", { exact: true }).click();
  await expect(page).toHaveURL(/\/week\/2026-W23$/);
}

test.describe("Week indienen (mocked)", () => {
  test("submits the week and reflects the submitted state", async ({ page }) => {
    await mockTrpc(page, {
      ...LIVE_HANDLERS,
      "timesheet.submit": () => ({
        status: "pending",
        submittedAt: "2026-06-04 09:00:00",
        history: [{ action: "submitted", createdAt: "2026-06-04 09:00:00" }],
      }),
    });
    await openWeek(page);

    const main = page.getByRole("main");
    // Open week → button is shown and status pill reads "open".
    const submit = main.getByRole("button", { name: "Week indienen" });
    await expect(submit).toBeVisible();
    await expect(main.getByText("open", { exact: true }).first()).toBeVisible();

    await submit.click();

    // Success toast + optimistic status flip to "in afwachting"; the now-pending
    // week is no longer submittable, so the button disappears.
    await expect(page.getByText("Week ingediend ter goedkeuring.")).toBeVisible({
      timeout: 10_000,
    });
    await expect(main.getByText("in afwachting", { exact: true }).first()).toBeVisible();
    await expect(submit).toBeHidden();
  });

  test("shows an error toast and keeps the week open when submission is rejected", async ({
    page,
  }) => {
    // Live data via the helper; the submit mutation is rejected with a 403
    // (the limited production key can't approve) — returned as a tRPC error
    // envelope carrying everhourStatus, so the hook hits permissionDenied.
    await mockTrpc(page, LIVE_HANDLERS);
    await page.route(/\/api\/trpc\/timesheet\.submit/, async (route) => {
      // Mirror the real wire shape: the server wraps the upstream EverhourError
      // as INTERNAL_SERVER_ERROR (HTTP 500) and its errorFormatter attaches the
      // upstream everhourStatus (403) to error.data — which everhourStatusOf reads.
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify([
          {
            error: {
              message: "Everhour 403 on /timesheets/12623/approval",
              code: -32603,
              data: {
                code: "INTERNAL_SERVER_ERROR",
                httpStatus: 500,
                path: "timesheet.submit",
                everhourStatus: 403,
              },
            },
          },
        ]),
      });
    });
    await openWeek(page);

    const main = page.getByRole("main");
    const submit = main.getByRole("button", { name: "Week indienen" });
    await submit.click();

    await expect(page.getByText("Indienen niet toegestaan met deze API-sleutel.")).toBeVisible({
      timeout: 10_000,
    });
    // Status stays "open" and the button remains for a retry.
    await expect(main.getByText("open", { exact: true }).first()).toBeVisible();
    await expect(submit).toBeVisible();
  });
});

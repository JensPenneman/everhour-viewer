import { expect, test } from "@playwright/test";
import {
  clearStorage,
  gotoWeek,
  makeWeek,
  mockLive,
  mockSync,
  sidebar,
  startSync,
} from "./support";

/**
 * Sync flow against a mocked `/api/sync` — deterministic NDJSON, so CI never
 * hammers the real Everhour API or depends on the current week's hours. Each
 * test installs its own stream, then drives the UI as the consumer sees it.
 */
test.describe("Sync flow (mocked)", () => {
  test.beforeEach(async ({ page }) => {
    await clearStorage(page);
    await mockLive(page);
  });

  test("streams weeks and shows a success toast", async ({ page }) => {
    await mockSync(page, { weeks: 3 });
    await startSync(page);

    await expect(page.getByRole("status").filter({ hasText: /Sync klaar/ })).toBeVisible({
      timeout: 10_000,
    });

    const nav = sidebar(page);
    await expect(nav.getByText("2026-W20", { exact: true })).toBeVisible();
    await expect(nav.getByText("2026-W19", { exact: true })).toBeVisible();
    await expect(nav.getByText("2026-W18", { exact: true })).toBeVisible();
  });

  test("delta sync skips already-known weeks", async ({ page }) => {
    // Seed a known week in the cache, so the sync request carries it as a
    // knownWeek for the server to skip.
    const cached = JSON.stringify({
      profile: null,
      weeks: [
        makeWeek({
          isoWeek: "2026-W20",
          weekId: 2520,
          from: "2026-05-11",
          to: "2026-05-17",
          status: "approved",
          seconds: 0,
          withEntry: false,
        }),
      ],
    });
    await page.addInitScript((seed) => {
      window.localStorage.setItem("everhour_viewer_data_v1", seed);
    }, cached);

    let postBody: { knownWeeks?: { isoWeek: string }[] } | undefined;
    await mockSync(page, {
      weeks: 0,
      counts: { new: 0, updated: 0, skipped: 1, totalWeeks: 1 },
      capture: (body) => {
        postBody = body as typeof postBody;
      },
    });

    await startSync(page);

    await expect(page.getByRole("status").filter({ hasText: /Sync klaar/ })).toBeVisible({
      timeout: 10_000,
    });

    expect(postBody?.knownWeeks?.length).toBeGreaterThan(0);
    expect(postBody?.knownWeeks?.[0]?.isoWeek).toBe("2026-W20");
  });

  test("selecting a week navigates to its real route", async ({ page }) => {
    await mockSync(page, { weeks: 3 });
    // The Next router owns the URL — the week is a real route segment whose
    // page renders from the route param.
    await gotoWeek(page, "2026-W20");
    await expect(page.getByRole("main").getByText("Mock task").first()).toBeVisible();
  });
});

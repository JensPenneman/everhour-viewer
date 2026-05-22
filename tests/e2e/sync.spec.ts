import { expect, test, type Route } from "@playwright/test";

/**
 * Sync E2E tests run against a mocked /api/sync endpoint — we don't want
 * to hammer the real Everhour API from CI or to be sensitive to the
 * current week's hours.
 *
 * Each test installs a route handler that responds with deterministic
 * NDJSON, then drives the UI as the streaming consumer would see it.
 */

interface SyncCounts {
  new: number;
  updated: number;
  skipped: number;
  totalWeeks: number;
}

function mockSyncResponse(weeks: number, counts: SyncCounts): string {
  const lines: string[] = [];
  lines.push(
    JSON.stringify({
      type: "profile",
      profile: {
        schemaVersion: 1,
        exportedAt: "2026-05-22T14:00:00",
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
      },
    }),
  );
  lines.push(JSON.stringify({ type: "plan", total: weeks, toFetch: weeks, toSkip: 0 }));
  for (let i = 0; i < weeks; i++) {
    const isoWeek = `2026-W${String(20 - i).padStart(2, "0")}`;
    lines.push(
      JSON.stringify({
        type: "week",
        current: i + 1,
        total: weeks,
        kind: "new",
        week: {
          schemaVersion: 2,
          exportedAt: "2026-05-22T14:00:00",
          user: { id: 1, name: "Test User", email: "test@example.com" },
          week: {
            isoWeek,
            weekId: 2520 - i,
            from: "2026-05-11",
            to: "2026-05-17",
          },
          approval: { status: "pending", submittedAt: null, history: [] },
          totals: { seconds: 28_800, hours: 8 },
          days: [
            {
              date: "2026-05-11",
              weekday: "Monday",
              totalSeconds: 28_800,
              entries: [
                {
                  task: {
                    id: "li:test",
                    name: "Mock task",
                    linearKey: "LS-1",
                    url: null,
                    labels: [],
                  },
                  seconds: 28_800,
                  lockReasons: [],
                },
              ],
            },
          ],
        },
      }),
    );
  }
  lines.push(JSON.stringify({ type: "done", counts }));
  return lines.join("\n") + "\n";
}

async function mockSync(route: Route, weeks: number, counts: SyncCounts): Promise<void> {
  await route.fulfill({
    status: 200,
    headers: { "Content-Type": "application/x-ndjson" },
    body: mockSyncResponse(weeks, counts),
  });
}

test.describe("Sync flow (mocked)", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => window.localStorage.clear());
  });

  test("streams weeks and shows a success toast", async ({ page }) => {
    await page.route("**/api/sync", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({ status: 200, body: JSON.stringify({ hasEnvKey: true }) });
        return;
      }
      await mockSync(route, 3, { new: 3, updated: 0, skipped: 0, totalWeeks: 3 });
    });

    await page.goto("/");
    await page.getByRole("button", { name: "Synchroniseer", exact: true }).first().click();

    await expect(page.getByRole("status").filter({ hasText: /Sync klaar/ })).toBeVisible({
      timeout: 10_000,
    });

    // Sidebar should reflect 3 weeks
    const sidebar = page.getByRole("complementary", { name: "Navigatie" });
    await expect(sidebar.getByText("2026-W20", { exact: true })).toBeVisible();
    await expect(sidebar.getByText("2026-W19", { exact: true })).toBeVisible();
    await expect(sidebar.getByText("2026-W18", { exact: true })).toBeVisible();
  });

  test("delta sync skips already-known weeks", async ({ page }) => {
    // Seed an approved week in localStorage.
    await page.addInitScript(() => {
      window.localStorage.setItem(
        "everhour_viewer_data_v1",
        JSON.stringify({
          profile: null,
          weeks: [
            {
              schemaVersion: 2,
              exportedAt: "2026-05-22T14:00:00",
              user: { id: 1, name: "T", email: "t@example.com" },
              week: {
                isoWeek: "2026-W20",
                weekId: 2520,
                from: "2026-05-11",
                to: "2026-05-17",
              },
              approval: { status: "approved", submittedAt: null, history: [] },
              totals: { seconds: 0, hours: 0 },
              days: [],
            },
          ],
        }),
      );
    });

    let postBody: { knownWeeks?: { isoWeek: string }[] } | undefined;
    await page.route("**/api/sync", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({ status: 200, body: JSON.stringify({ hasEnvKey: true }) });
        return;
      }
      postBody = route.request().postDataJSON();
      await mockSync(route, 0, { new: 0, updated: 0, skipped: 1, totalWeeks: 1 });
    });

    await page.goto("/");
    await page.getByRole("button", { name: "Synchroniseer", exact: true }).first().click();

    await expect(page.getByRole("status").filter({ hasText: /Sync klaar/ })).toBeVisible({
      timeout: 10_000,
    });

    expect(postBody?.knownWeeks?.length).toBeGreaterThan(0);
    expect(postBody?.knownWeeks?.[0]?.isoWeek).toBe("2026-W20");
  });
});

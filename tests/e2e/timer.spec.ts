import { expect, test } from "@playwright/test";
import { clearStorage, gotoVandaag, makeWeek, mockLiveTimer, mockSync } from "./support";

/**
 * Live "Vandaag" timer flow against fully mocked API routes — no real Everhour
 * calls. Drives the core loop: land on Vandaag, start a timer on a recent task,
 * see it running, then stop it.
 */
test.describe("Vandaag — live timer (mocked)", () => {
  test.beforeEach(async ({ page }) => {
    await clearStorage(page);
    await mockSync(page, { weeks: [makeWeek()] });
    await mockLiveTimer(page);
  });

  test("starts a timer on a recent task and stops it", async ({ page }) => {
    // First run → sync to load profile + a recent task, then land on Vandaag.
    await gotoVandaag(page);

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

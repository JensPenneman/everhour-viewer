import { expect, test } from "@playwright/test";
import { clearStorage, gotoWeek, makeWeek, mockLive, mockSync } from "./support";

/**
 * "Week indienen" (submit a week's timesheet for approval), end to end against
 * a mocked /api/sync + tRPC. We sync a single open week, open it, and exercise
 * both the success path (status flips to "in afwachting" + toast) and the
 * failure path (the limited API key is rejected → error toast, status
 * unchanged). The week's status comes from the synced data, so the optimistic
 * update from `timesheet.submit` is what we're really asserting on success.
 */
test.describe("Week indienen (mocked)", () => {
  test.beforeEach(async ({ page }) => {
    await clearStorage(page);
    await mockSync(page, { weeks: [makeWeek()] });
  });

  test("submits the week and reflects the submitted state", async ({ page }) => {
    await mockLive(page, {
      "timesheet.submit": () => ({
        status: "pending",
        submittedAt: "2026-06-04 09:00:00",
        history: [{ action: "submitted", createdAt: "2026-06-04 09:00:00" }],
      }),
    });
    await gotoWeek(page, "2026-W23");

    const main = page.getByRole("main");
    // Open week → button is shown and the status pill reads "open".
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
    await mockLive(page);
    // The submit mutation is rejected the way the server reports an upstream
    // EverhourError: wrapped as INTERNAL_SERVER_ERROR (HTTP 500) with the
    // upstream everhourStatus (403) on error.data — which the hook reads to
    // hit permissionDenied.
    await page.route(/\/api\/trpc\/timesheet\.submit/, async (route) => {
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
    await gotoWeek(page, "2026-W23");

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

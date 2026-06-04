import { expect, type Page } from "@playwright/test";

/**
 * Page actions shared by the e2e suite — the handful of flows every spec drives
 * (clean storage, sync, navigate to a week). Install the mocks (see ./mocks)
 * before calling these.
 */

/** Start the next navigation from a clean browser. */
export async function clearStorage(page: Page): Promise<void> {
  await page.addInitScript(() => window.localStorage.clear());
}

/** The week-navigation sidebar. */
export function sidebar(page: Page) {
  return page.getByRole("complementary", { name: "Navigatie" });
}

/** Land on "/" and click "Synchroniseer" (does not wait for a landing view). */
export async function startSync(page: Page): Promise<void> {
  await page.goto("/");
  await page.getByRole("button", { name: "Synchroniseer", exact: true }).first().click();
}

/** Sync, then wait for the "Vandaag" view to render. */
export async function gotoVandaag(page: Page): Promise<void> {
  await startSync(page);
  await expect(page.getByRole("heading", { name: "Vandaag" })).toBeVisible({ timeout: 15_000 });
}

/** Sync, then open a week's detail route from the sidebar. */
export async function gotoWeek(page: Page, isoWeek: string): Promise<void> {
  await startSync(page);
  await sidebar(page).getByText(isoWeek, { exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/week/${isoWeek}$`));
}

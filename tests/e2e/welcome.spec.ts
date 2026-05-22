import { expect, test } from "@playwright/test";

test.describe("Welcome screen", () => {
  test.beforeEach(async ({ page }) => {
    // Start with a clean browser state every time.
    await page.addInitScript(() => {
      window.localStorage.clear();
    });
  });

  test("renders the onboarding card", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Welkom" })).toBeVisible();
    await expect(page.getByText("Voeg je API-sleutel toe")).toBeVisible();
    await expect(page.getByText("Synchroniseer", { exact: true }).first()).toBeVisible();
  });

  test("opens and closes the API key dialog", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /Sleutel (instellen|wijzigen)/ }).click();
    await expect(page.getByRole("dialog", { name: /Everhour API-sleutel/i })).toBeVisible();
    await page.getByRole("button", { name: "Annuleer" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("saves a user-supplied key to localStorage", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /Sleutel (instellen|wijzigen)/ }).click();
    await page.getByPlaceholder("xxxx-xxxx-xxxx-xxxx").fill("test-key-1234");
    await page.getByRole("button", { name: "Opslaan" }).click();
    const stored = await page.evaluate(() => window.localStorage.getItem("everhour_api_key"));
    expect(stored).toBe("test-key-1234");
  });

  test("the header has no NextJS branding", async ({ page }) => {
    await page.goto("/");
    const headerText = await page.locator("header").innerText();
    expect(headerText).toContain("Everhour viewer");
    expect(headerText.toLowerCase()).not.toContain("nextjs");
    expect(headerText.toLowerCase()).not.toContain("next.js");
  });
});

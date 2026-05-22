#!/usr/bin/env node
/**
 * Drive the app through its main states with Playwright and save PNGs to
 * `screenshots/`. Intended as a developer-facing visual-regression check;
 * the produced images are *not* committed (they contain real timesheet
 * data when run against `EVERHOUR_API_KEY`).
 *
 * Usage:
 *   npm run shoot                # uses http://localhost:3000
 *   BASE_URL=http://… npm run shoot
 *
 * Requires the dev server already running. The Playwright config used by
 * `npm run test:e2e` auto-starts it; this script intentionally does not,
 * because we want to attach to whatever the developer is currently
 * looking at.
 */
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const SHOTS = resolve(ROOT, "screenshots");
mkdirSync(SHOTS, { recursive: true });

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";

const browser = await chromium.launch({ channel: "chrome", headless: true });
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
});
const page = await ctx.newPage();
page.on("pageerror", (e) => console.error("[pageerror]", e.message));

async function shot(name) {
  const path = resolve(SHOTS, `${name}.png`);
  await page.screenshot({ path });
  console.info(`  → ${name}.png`);
}

console.info("01: welcome");
await page.goto(BASE_URL, { waitUntil: "networkidle" });
await page.getByRole("heading", { name: "Welkom" }).waitFor();
await shot("01-welcome");

console.info("02: key dialog");
await page.getByRole("button", { name: /Sleutel (instellen|wijzigen)/ }).click();
await page.getByRole("dialog").waitFor();
await shot("02-key-dialog");
await page.getByRole("button", { name: "Annuleer" }).click();

console.info("03: triggering sync (real API; this can take ~1min)");
await page.getByRole("button", { name: "Synchroniseer", exact: true }).first().click();

// Mid-sync snapshot — wait until at least the plan is in.
await page
  .locator("header")
  .filter({ hasText: /weken te verwerken|Week \d+\/\d+/ })
  .first()
  .waitFor({ timeout: 30_000 })
  .catch(() => undefined);
await shot("03-sync-progress");

// Wait for sync to finish (or fail) — header switches back to totals.
await page
  .locator("header")
  .filter({ hasText: /\d+(\.\d+)?u totaal|Sync mislukt/ })
  .first()
  .waitFor({ timeout: 180_000 });
await page.waitForTimeout(1500);

console.info("04: week detail");
await shot("04-week-detail");

console.info("05: profile detail");
await page.locator("aside button").first().click();
await page.waitForTimeout(300);
await shot("05-profile-detail");

console.info("06: menu open");
await page.getByRole("button", { name: "Menu" }).click();
await page.waitForTimeout(150);
await shot("06-menu-open");
await page.keyboard.press("Escape");

console.info("07: delta sync (should mostly skip)");
await page.getByRole("button", { name: "Synchroniseer", exact: true }).first().click();
await page.waitForTimeout(2500);
await shot("07-delta-sync");

await browser.close();
console.info("done.");

#!/usr/bin/env node
// Drives the local dev server through real interactions to capture screenshots
// of the empty, dialog, sync-in-progress, and post-sync states.

import puppeteer from "puppeteer-core";
import { mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const SHOTS = resolve(ROOT, "screenshots");
mkdirSync(SHOTS, { recursive: true });

const URL_BASE = process.env.URL_BASE ?? "http://localhost:3000";
const CHROME = process.env.CHROME_BIN ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "new",
  defaultViewport: { width: 1440, height: 900, deviceScaleFactor: 2 },
  args: ["--hide-scrollbars", "--no-first-run", "--no-default-browser-check"],
});

const page = await browser.newPage();
page.on("pageerror", (e) => console.error("[pageerror]", e.message));
page.on("console", (msg) => {
  if (msg.type() === "error") console.error("[console.error]", msg.text());
});

async function shot(name) {
  const path = resolve(SHOTS, `${name}.png`);
  await page.screenshot({ path, fullPage: false });
  console.log(`  → ${name}.png`);
}

async function waitFor(selector, opts = {}) {
  return page.waitForSelector(selector, { timeout: 20000, ...opts });
}

console.log("01: welcome");
await page.goto(URL_BASE, { waitUntil: "networkidle0" });
await waitFor("h2"); // welcome heading
await shot("01-welcome");

console.log("02: key dialog");
await page.click('button:has-text("Sleutel instellen")').catch(() => {});
await page.evaluate(() => {
  // fall back: click the Sleutel instellen button by text
  const btn = [...document.querySelectorAll("button")].find((b) => /Sleutel (instellen|wijzigen)/i.test(b.textContent ?? ""));
  if (btn) btn.click();
});
await page.waitForSelector('input[type="password"]', { timeout: 5000 });
await shot("02-key-dialog");
await page.evaluate(() => {
  const btn = [...document.querySelectorAll("button")].find((b) => b.textContent?.trim() === "Annuleer");
  btn?.click();
});

console.log("03: triggering sync (this fetches ~46 weeks, may take ~1 min)");
await page.evaluate(() => {
  const btn = [...document.querySelectorAll("header button")].find((b) => b.textContent?.trim() === "Synchroniseer");
  btn?.click();
});

// Capture mid-sync (after a few weeks have streamed in)
await new Promise((r) => setTimeout(r, 4000));
await shot("03-sync-progress");

// Wait for the progress to clear (or for the toast to appear)
await page.waitForFunction(
  () => {
    const headerText = document.querySelector("header")?.textContent ?? "";
    return /weken · .*u totaal|Sync klaar|Sync mislukt/.test(headerText);
  },
  { timeout: 180000 },
);

await new Promise((r) => setTimeout(r, 1500));

console.log("04: week detail");
await shot("04-week-detail");

console.log("05: profile detail");
await page.evaluate(() => {
  const card = document.querySelector("aside button");
  card?.click();
});
await new Promise((r) => setTimeout(r, 300));
await shot("05-profile-detail");

console.log("06: menu open");
await page.evaluate(() => {
  const btn = [...document.querySelectorAll("header button")].find((b) => b.getAttribute("aria-label") === "Menu");
  btn?.click();
});
await new Promise((r) => setTimeout(r, 200));
await shot("06-menu-open");

console.log("07: re-sync (delta) — should mostly skip");
// close menu, scroll a week back into view, then re-sync
await page.keyboard.press("Escape");
await page.evaluate(() => {
  const btn = [...document.querySelectorAll("header button")].find((b) => b.textContent?.trim() === "Synchroniseer");
  btn?.click();
});
await new Promise((r) => setTimeout(r, 2500));
await shot("07-delta-sync");

await browser.close();
console.log("done.");

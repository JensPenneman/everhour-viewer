#!/usr/bin/env node
/**
 * Lighthouse quality gate.
 *
 * Audits the production app and exits non-zero unless *every* category scores
 * in Lighthouse's green band (>= 90). Run via `npm run lighthouse`, which
 * builds first; this script then starts `next start` on its own port, audits,
 * and tears everything down.
 *
 * Environment overrides:
 *   LH_URL        audit this URL instead of spawning a server (e.g. a running
 *                 dev/prod server) — skips the build+start dance.
 *   LH_PORT       port for the spawned prod server (default 4317).
 *   LH_THRESHOLD  green threshold, 0..100 (default 90).
 *   LH_RUNS       runs per audit; the median score per category is gated
 *                 (default 3) to smooth out run-to-run noise.
 *   CHROME_PATH   explicit Chrome/Chromium binary (used in CI).
 */
import { spawn } from "node:child_process";
import lighthouse from "lighthouse";
import * as chromeLauncher from "chrome-launcher";

const THRESHOLD = Number(process.env.LH_THRESHOLD ?? 90);
const RUNS = Math.max(1, Number(process.env.LH_RUNS ?? 3));
const PORT = Number(process.env.LH_PORT ?? 4317);
const URL = process.env.LH_URL ?? `http://localhost:${PORT}`;
const MANAGE_SERVER = !process.env.LH_URL;
const CATEGORIES = ["performance", "accessibility", "best-practices", "seo"];

// Desktop form factor — this is a fixed-sidebar desktop app, audited as one.
// Inlined (rather than importing lighthouse's desktop-config) so we don't
// depend on the package's internal module layout.
const DESKTOP = {
  formFactor: "desktop",
  screenEmulation: {
    mobile: false,
    width: 1350,
    height: 940,
    deviceScaleFactor: 1,
    disabled: false,
  },
  throttling: { rttMs: 40, throughputKbps: 10_240, cpuSlowdownMultiplier: 1 },
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForServer(url, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      /* not up yet */
    }
    await sleep(500);
  }
  throw new Error(`Server never became ready at ${url}`);
}

function median(nums) {
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

let server;
let chrome;
try {
  if (MANAGE_SERVER) {
    console.info(`▸ starting prod server on :${PORT}`);
    server = spawn("npm", ["run", "start"], {
      env: { ...process.env, PORT: String(PORT) },
      stdio: "ignore",
      detached: true,
    });
    await waitForServer(URL);
  }

  console.info(
    `▸ launching Chrome${process.env.CHROME_PATH ? ` (${process.env.CHROME_PATH})` : ""}`,
  );
  chrome = await chromeLauncher.launch({
    chromePath: process.env.CHROME_PATH || undefined,
    chromeFlags: ["--headless=new", "--no-sandbox", "--disable-gpu"],
  });

  const scores = Object.fromEntries(CATEGORIES.map((c) => [c, []]));
  for (let run = 1; run <= RUNS; run++) {
    console.info(`▸ lighthouse run ${run}/${RUNS} → ${URL}`);
    const { lhr } = await lighthouse(
      URL,
      { port: chrome.port, logLevel: "error", output: "json", ...DESKTOP },
      undefined,
    );
    for (const c of CATEGORIES) {
      const s = lhr.categories[c]?.score;
      if (typeof s === "number") scores[c].push(Math.round(s * 100));
    }
  }

  const results = CATEGORIES.map((c) => ({
    category: c,
    score: scores[c].length ? median(scores[c]) : 0,
  }));
  const failed = results.filter((r) => r.score < THRESHOLD);

  console.info(`\nLighthouse (desktop) · ${URL} · median of ${RUNS} · green ≥ ${THRESHOLD}\n`);
  for (const { category, score } of results) {
    console.info(
      `  ${score >= THRESHOLD ? "✓" : "✗"}  ${category.padEnd(16)} ${String(score).padStart(3)}`,
    );
  }
  console.info("");

  if (failed.length) {
    console.error(
      `✗ Lighthouse gate FAILED — below green (${THRESHOLD}): ` +
        failed.map((r) => `${r.category} ${r.score}`).join(", "),
    );
    process.exitCode = 1;
  } else {
    console.info("✓ All Lighthouse categories are green.");
  }
} catch (err) {
  console.error("✗ Lighthouse gate errored:", err?.message ?? err);
  process.exitCode = 1;
} finally {
  if (chrome) {
    try {
      await chrome.kill(); // chrome-launcher's kill() may return void, so just guard it
    } catch {
      /* already gone */
    }
  }
  if (server?.pid) {
    try {
      process.kill(-server.pid, "SIGTERM"); // kill the whole process group (npm + next)
    } catch {
      /* already gone */
    }
  }
}

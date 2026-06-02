import withSerwistInit from "@serwist/next";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
};

/**
 * Serwist precaches the app shell + assets into a service worker
 * (`public/sw.js`) so the app opens with no network and updates when a new
 * build ships. We register it ourselves (see ServiceWorkerManager) to surface
 * an "update available" prompt.
 *
 * It injects the precache manifest via a **webpack** plugin, so:
 *  - the production build must run with `--webpack` (see package.json), and
 *  - we only apply the wrapper for the production build — in dev, `next dev`
 *    runs the plain config under Turbopack (attaching a webpack config there
 *    trips Next 16's "webpack config under Turbopack" error, and a SW would
 *    fight HMR anyway).
 */
const isDev = process.env.NODE_ENV !== "production";

const withSerwist = withSerwistInit({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  register: false,
  // Off in dev: silences Serwist's Turbopack warning and keeps a SW from
  // fighting HMR. The conditional export below also keeps Serwist's webpack
  // config off the Turbopack dev server entirely.
  disable: isDev,
});

export default isDev ? nextConfig : withSerwist(nextConfig);

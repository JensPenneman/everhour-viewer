"use client";

import { useEffect } from "react";

export interface ServiceWorkerManagerProps {
  /** Called once a newer service worker has installed and is ready to take over. */
  readonly onUpdate: () => void;
}

/**
 * Registers the Serwist-built service worker (`/sw.js`) in production and
 * fires `onUpdate` when a new build has been fetched and installed, so the
 * shell can prompt a reload. Registering ourselves (rather than letting
 * Serwist auto-register) is what gives us that update signal. No-op in dev and
 * where service workers aren't supported. Renders nothing.
 */
export function ServiceWorkerManager({ onUpdate }: ServiceWorkerManagerProps): null {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

    let cancelled = false;
    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        reg.addEventListener("updatefound", () => {
          const installing = reg.installing;
          if (!installing) return;
          installing.addEventListener("statechange", () => {
            // A new worker reached "installed" while one already controls the
            // page → an update is waiting. (First-ever install has no
            // controller, so this correctly skips the initial load.)
            if (
              !cancelled &&
              installing.state === "installed" &&
              navigator.serviceWorker.controller
            ) {
              onUpdate();
            }
          });
        });
      })
      .catch(() => {
        /* registration failures are non-fatal — the app still works online */
      });

    return () => {
      cancelled = true;
    };
  }, [onUpdate]);

  return null;
}

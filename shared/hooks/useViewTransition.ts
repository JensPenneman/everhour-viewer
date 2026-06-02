"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";
import { parseRoute, routeDepth } from "@/lib/routing";

export interface NavigateOptions {
  /** Use `router.replace` instead of `push` (no history entry). */
  readonly replace?: boolean;
  /** Skip the animation — e.g. rapid keyboard stepping. Default `true`. */
  readonly animate?: boolean;
}

export type Navigate = (href: string, opts?: NavigateOptions) => void;

interface ViewTransitionLike {
  readonly finished: Promise<unknown>;
}
type DocumentWithViewTransition = Document & {
  startViewTransition?: (callback: () => void | Promise<void>) => ViewTransitionLike;
};

/** Hard cap so a no-op navigation can never leave a transition pending. */
const MAX_TRANSITION_MS = 700;

/**
 * Router navigation wrapped in the browser's native View Transitions API.
 *
 * The active view cross-fades (or slides, for a forward/back move derived
 * from route depth) while the header and sidebar stay fixed — only the
 * element tagged `view-transition-name: main-view` animates.
 *
 * Pure progressive enhancement: browsers without the API and users who
 * prefer reduced motion navigate instantly, with zero added bundle. The DOM
 * swap happens inside the transition's update callback, which resolves when
 * the new pathname commits (or a safety timeout fires).
 */
export function useViewTransition(): Navigate {
  const router = useRouter();
  const pathname = usePathname();
  // Resolver for the in-flight transition's update callback; called once the
  // navigation it triggered has committed (a new `pathname`).
  const resolveRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    resolveRef.current?.();
    resolveRef.current = null;
  }, [pathname]);

  return useCallback(
    (href, opts) => {
      const go = () => (opts?.replace ? router.replace(href) : router.push(href));

      const doc = document as DocumentWithViewTransition;
      const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

      if (
        opts?.animate === false ||
        href === pathname ||
        typeof doc.startViewTransition !== "function" ||
        reduceMotion
      ) {
        go();
        return;
      }

      const delta = routeDepth(parseRoute(href)) - routeDepth(parseRoute(pathname ?? "/"));
      const root = document.documentElement;
      root.dataset.vt = delta > 0 ? "forward" : delta < 0 ? "back" : "cross";

      const transition = doc.startViewTransition(
        () =>
          new Promise<void>((resolve) => {
            const timer = setTimeout(() => {
              resolveRef.current = null;
              resolve();
            }, MAX_TRANSITION_MS);
            resolveRef.current = () => {
              clearTimeout(timer);
              resolve();
            };
            go();
          }),
      );

      void transition.finished.finally(() => {
        delete root.dataset.vt;
      });
    },
    [router, pathname],
  );
}

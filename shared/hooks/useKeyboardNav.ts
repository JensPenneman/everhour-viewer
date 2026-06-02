"use client";

import { useEffect } from "react";

export interface KeyboardNavOptions {
  readonly enabled: boolean;
  readonly onPrev: () => void;
  readonly onNext: () => void;
}

/**
 * Wire `j`/`↓` to {@link KeyboardNavOptions.onNext} and `k`/`↑` to
 * `onPrev` for any focus that isn't inside an editable element.
 */
export function useKeyboardNav({ enabled, onPrev, onNext }: KeyboardNavOptions): void {
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.matches("input, textarea") || target.tagName === "SUMMARY")) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === "ArrowDown" || e.key === "j") {
        e.preventDefault();
        onNext();
      } else if (e.key === "ArrowUp" || e.key === "k") {
        e.preventDefault();
        onPrev();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled, onPrev, onNext]);
}

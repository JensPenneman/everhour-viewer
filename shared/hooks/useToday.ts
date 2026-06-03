"use client";

import { useEffect, useState } from "react";
import { toLocalIsoDate } from "@/lib/format";

/**
 * The current local date as `YYYY-MM-DD`, kept fresh across midnight.
 *
 * A time-tracker tab is often left open overnight; a date captured once at
 * mount would silently bucket the next day's work (timer totals, the
 * saved-minutes ledger) under yesterday. This recomputes at the next local
 * midnight and whenever the tab regains focus/visibility (covering a slept
 * device whose timer never fired). The setter is a no-op when the date is
 * unchanged, so it never causes a spurious re-render.
 */
export function useToday(): string {
  const [today, setToday] = useState(() => toLocalIsoDate(new Date()));

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    // setState bails out when the next value is identical (same string), so
    // focus/visibility refreshes are free unless the day actually changed.
    const refresh = () => setToday(toLocalIsoDate(new Date()));

    const scheduleMidnight = () => {
      const now = new Date();
      const nextMidnight = new Date(now);
      nextMidnight.setHours(24, 0, 0, 100); // a hair past local midnight
      timer = setTimeout(() => {
        refresh();
        scheduleMidnight();
      }, nextMidnight.getTime() - now.getTime());
    };

    scheduleMidnight();
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);

  return today;
}

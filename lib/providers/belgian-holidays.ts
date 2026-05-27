import { holidaysInRange } from "@/lib/events/holidays";
import type { Provider } from "./types";

/**
 * Belgian public-holiday provider.
 *
 * Always-on, no credentials. Backed by `lib/events/holidays.ts` which
 * wraps the `date-holidays` package; this file is the provider-shaped
 * adapter.
 */
export const belgianHolidaysProvider: Provider = {
  meta: {
    id: "holidays:be",
    name: "Belgische feestdagen",
    description: "Officiële Belgische feestdagen (in het Nederlands).",
    category: "holidays",
    icon: "🇧🇪",
  },
  status() {
    return { ready: true, message: "Altijd actief." };
  },
  async fetchEvents({ from, to }) {
    return holidaysInRange(from, to, { country: "BE", language: "nl" });
  },
};

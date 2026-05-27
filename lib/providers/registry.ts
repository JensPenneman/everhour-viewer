import { belgianHolidaysProvider } from "./belgian-holidays";
import { icsProvider } from "./ics";
import type { Provider } from "./types";

/**
 * Single source of truth for which providers exist.
 *
 * Adding a new provider is two lines: implement the {@link Provider}
 * contract somewhere under `lib/providers/`, and import + push it here.
 * The Integrations dialog and `useDayEvents` will pick it up
 * automatically.
 */
export const PROVIDERS: ReadonlyArray<Provider> = [belgianHolidaysProvider, icsProvider];

export function providerById(id: string): Provider | undefined {
  return PROVIDERS.find((p) => p.meta.id === id);
}

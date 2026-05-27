import type { DayEvent } from "@/lib/events";

/**
 * Coarse grouping shown in the Integrations dialog header.
 *
 * Each provider declares the category it sits in so the UI can group
 * related sources together without hard-coding lists.
 */
export type ProviderCategory = "holidays" | "leave" | "calendar" | "tasks" | "code";

/**
 * Static metadata for a provider. Declared once per provider module and
 * surfaced verbatim in the Integrations dialog.
 */
export interface ProviderMeta {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly category: ProviderCategory;
  /** Short emoji or single character used as an icon glyph. */
  readonly icon: string;
}

/**
 * Live state of a provider, refreshed by the Integrations UI.
 *
 * `ready` gates whether the provider is included in {@link Provider.fetchEvents}
 * calls. `message` is a one-line human-readable status, shown next to the
 * provider's row.
 */
export interface ProviderStatus {
  readonly ready: boolean;
  readonly message: string;
  /** Count of events currently contributed (when known). */
  readonly eventCount?: number;
}

export interface FetchEventsArgs {
  readonly from: string;
  readonly to: string;
  readonly signal?: AbortSignal;
}

/**
 * The minimal contract for an external event source.
 *
 * Implementations are simple objects — not classes — so they can be
 * shared between server and client modules without `this`-binding
 * surprises. Mutations (connect / disconnect / re-import) are exposed
 * through the per-provider settings React components rather than this
 * interface, keeping the core read path narrow.
 */
export interface Provider {
  readonly meta: ProviderMeta;
  /** Cheap, synchronous status check. Reads from storage if it has any. */
  status(): ProviderStatus;
  /** Resolve events for a date range. Must return `[]` when not ready. */
  fetchEvents(args: FetchEventsArgs): Promise<ReadonlyArray<DayEvent>>;
}

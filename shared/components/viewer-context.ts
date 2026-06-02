"use client";

import { createContext, useContext } from "react";
import type { ViewerCacheApi } from "@/features/timesheets";
import type { DayEvent, DayEventKind } from "@/lib/events";
import type { ApiKeyApi, Navigate } from "@/shared/hooks";

/**
 * Cross-cutting state the {@link AppShell} owns and route-segment pages
 * consume. The shell renders the persistent chrome (header, sidebar, dialogs,
 * toasts) and provides this; pages read their slice of it plus their own route
 * `params`. Keeping it in context is what lets the shell survive navigation
 * while pages come and go — the idiomatic App Router split.
 */
export interface ViewerContextValue {
  readonly apiKey: ApiKeyApi;
  readonly cache: ViewerCacheApi;
  readonly eventsForDate: (isoDate: string) => ReadonlyArray<DayEvent>;
  readonly navigate: Navigate;
  /** Run a delta sync (or a forced full re-fetch). */
  readonly runSync: (force?: boolean) => void;
  readonly openKeyDialog: () => void;
  readonly openFilePicker: () => void;
  readonly onAddEvent: (date: string, kind: DayEventKind) => void;
  readonly onRemoveEvent: (id: string) => void;
}

const ViewerContext = createContext<ViewerContextValue | null>(null);

export const ViewerProvider = ViewerContext.Provider;

export function useViewer(): ViewerContextValue {
  const ctx = useContext(ViewerContext);
  if (!ctx) throw new Error("useViewer must be used within <AppShell>");
  return ctx;
}

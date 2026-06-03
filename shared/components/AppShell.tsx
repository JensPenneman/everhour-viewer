"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { IntegrationsDialog, useDayEvents } from "@/features/events";
import { LiveSessionProvider, ShellTimer } from "@/features/live";
import {
  buildBackupFile,
  downloadBackup,
  readBackupFiles,
  useStreamingSync,
} from "@/features/sync";
import { useViewerCache } from "@/features/timesheets";
import { toLocalIsoDate } from "@/lib/format";
import { useOnline } from "@/lib/query";
import { PROFILE_HREF, TODAY_HREF, parseRoute, weekHref } from "@/lib/routing";
import { useApiKey, useKeyboardNav, useToasts, useViewTransition } from "@/shared/hooks";
import { Header } from "./Header";
import { KeyDialog } from "./KeyDialog";
import { ServiceWorkerManager } from "./ServiceWorkerManager";
import { Sidebar, type SidebarView } from "./Sidebar";
import { ToastTray } from "./ToastTray";
import { ViewerProvider, type ViewerContextValue } from "./viewer-context";

/**
 * The persistent app shell: header, sidebar, toasts, and dialogs, with the
 * active route's page rendered into `<main>` as `children`. It owns all the
 * cross-cutting state (API key, cached profile/weeks, sync, day-events, toasts,
 * dialogs) and exposes it to pages through {@link ViewerProvider} — so the
 * chrome stays mounted across navigations while pages swap in and out.
 *
 * The URL (real route segments) drives which page renders; the shell only
 * reads the pathname to highlight the sidebar and to scope keyboard week-
 * stepping. While the persisted cache restores, `<main>` stays blank so a
 * returning user never flashes onboarding.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const apiKey = useApiKey();
  const cache = useViewerCache();
  const sync = useStreamingSync();
  const toasts = useToasts();
  const events = useDayEvents();

  const {
    setRange: setEventRange,
    forDate: eventsForDate,
    addManual: addManualEvent,
    removeManual: removeManualEvent,
    refreshProviders,
  } = events;
  const toastsPush = toasts.push;

  const [menuOpen, setMenuOpen] = useState(false);
  const [keyDialogOpen, setKeyDialogOpen] = useState(false);
  const [integrationsOpen, setIntegrationsOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const navigate = useViewTransition();
  const pathname = usePathname();
  const route = useMemo(() => parseRoute(pathname ?? TODAY_HREF), [pathname]);

  const routeIso = route.view === "week" ? route.isoWeek : null;
  const effectiveActiveIso = routeIso ?? cache.sortedWeeks[0]?.week.isoWeek ?? null;
  const dayDate = route.view === "week" ? route.date : null;

  // Map the URL onto a sidebar highlight. Before any key/data, fall back to the
  // welcome screen marker so the sidebar shows the empty state.
  const sidebarView: SidebarView = useMemo(() => {
    const hasData = cache.weeks.length > 0 || cache.profile !== null;
    if (!hasData) return "empty";
    if (route.view === "profile" && cache.profile) return "profile";
    if (route.view === "week") return "week";
    return "today";
  }, [route.view, cache.weeks.length, cache.profile]);

  // Keep the holiday / ICS provider window aligned with the loaded weeks.
  useEffect(() => {
    if (cache.sortedWeeks.length === 0) return;
    const newest = cache.sortedWeeks[0];
    const oldest = cache.sortedWeeks[cache.sortedWeeks.length - 1];
    if (newest && oldest) setEventRange(oldest.week.from, newest.week.to);
  }, [cache.sortedWeeks, setEventRange]);

  const onAddEvent = useCallback<ViewerContextValue["onAddEvent"]>(
    (date, kind) => {
      const ev = addManualEvent(date, kind);
      toastsPush(`${ev.label} toegevoegd op ${date}`, "good");
    },
    [addManualEvent, toastsPush],
  );

  const onRemoveEvent = useCallback(
    (id: string) => {
      removeManualEvent(id);
      toastsPush("Event verwijderd", "good");
    },
    [removeManualEvent, toastsPush],
  );

  useKeyboardNav({
    enabled: route.view === "week" && dayDate === null && cache.sortedWeeks.length > 0,
    onPrev: () => {
      const idx = cache.sortedWeeks.findIndex((w) => w.week.isoWeek === effectiveActiveIso);
      const next = cache.sortedWeeks[Math.max(0, idx - 1)];
      if (next) navigate(weekHref(next.week.isoWeek), { replace: true, animate: false });
    },
    onNext: () => {
      const idx = cache.sortedWeeks.findIndex((w) => w.week.isoWeek === effectiveActiveIso);
      const next = cache.sortedWeeks[Math.min(cache.sortedWeeks.length - 1, idx + 1)];
      if (next) navigate(weekHref(next.week.isoWeek), { replace: true, animate: false });
    },
  });

  const runSync = useCallback(
    async (force = false) => {
      if (!apiKey.canSync) {
        setKeyDialogOpen(true);
        return;
      }
      // Profile + weeks stream straight into the query cache; no callbacks.
      await sync.run({
        apiKey: apiKey.readUserKey(),
        force,
        knownWeeks: cache.weeks.map((w) => ({
          isoWeek: w.week.isoWeek,
          status: w.approval.status,
          schemaVersion: w.schemaVersion,
        })),
        onDone: (counts) => {
          toastsPush(
            `Sync klaar — ${counts.new} nieuw · ${counts.updated} bijgewerkt · ${counts.skipped} ongewijzigd`,
            "good",
          );
        },
        onError: (message) => toastsPush(`Sync mislukt: ${message}`, "error"),
      });
    },
    [apiKey, cache, sync, toastsPush],
  );

  const onSync = useCallback(() => {
    setMenuOpen(false);
    void runSync(false);
  }, [runSync]);

  const onForceSync = useCallback(() => {
    setMenuOpen(false);
    void runSync(true);
  }, [runSync]);

  const onDownloadBackup = useCallback(() => {
    setMenuOpen(false);
    if (!cache.profile && cache.weeks.length === 0) {
      toastsPush("Niets om te exporteren", "error");
      return;
    }
    const backup = buildBackupFile(cache.profile, cache.weeks);
    downloadBackup(`everhour-backup-${toLocalIsoDate(new Date())}.json`, backup);
    toastsPush(`Backup gedownload (${cache.weeks.length} weken)`, "good");
  }, [cache.profile, cache.weeks, toastsPush]);

  const onClearCache = useCallback(() => {
    setMenuOpen(false);
    if (!confirm("Lokale gegevens wissen? Je API-sleutel blijft bewaard.")) return;
    cache.clear();
    navigate(TODAY_HREF);
    toastsPush("Cache gewist", "good");
  }, [cache, navigate, toastsPush]);

  const onLoadFiles = useCallback(
    async (files: FileList) => {
      const loaded = await readBackupFiles(Array.from(files));
      if (!loaded.hasWeeks && !loaded.hasProfile) return;
      if (loaded.hasProfile) cache.setProfile(loaded.profile);
      if (loaded.hasWeeks) cache.upsertWeeks(loaded.weeks);
      if (loaded.hasWeeks) {
        const next = [...loaded.weeks].sort((a, b) => b.week.from.localeCompare(a.week.from))[0];
        if (next) navigate(weekHref(next.week.isoWeek));
      } else if (loaded.hasProfile) {
        navigate(PROFILE_HREF);
      }
      const parts: string[] = [];
      if (loaded.hasProfile) parts.push("profiel");
      if (loaded.hasWeeks) {
        parts.push(`${loaded.weeks.length} ${loaded.weeks.length === 1 ? "week" : "weken"}`);
      }
      toastsPush(`Geladen: ${parts.join(" + ")}`, "good");
    },
    [cache, navigate, toastsPush],
  );

  const onSubmitKey = useCallback(
    (value: string) => {
      apiKey.setUserKey(value);
      setKeyDialogOpen(false);
      toastsPush(value ? "API-sleutel opgeslagen" : "API-sleutel verwijderd", "good");
    },
    [apiKey, toastsPush],
  );

  const openKeyDialog = useCallback(() => {
    setMenuOpen(false);
    setKeyDialogOpen(true);
  }, []);

  const openFilePicker = useCallback(() => fileInputRef.current?.click(), []);

  const onToastFromDialog = useCallback(
    (message: string, kind: "good" | "error") => toastsPush(message, kind),
    [toastsPush],
  );

  const online = useOnline();
  const onSwUpdate = useCallback(
    () => toastsPush("Nieuwe versie beschikbaar — herlaad om bij te werken.", "info"),
    [toastsPush],
  );

  const ctx = useMemo<ViewerContextValue>(
    () => ({
      apiKey,
      cache,
      eventsForDate,
      navigate,
      runSync: (force = false) => void runSync(force),
      openKeyDialog,
      openFilePicker,
      onAddEvent,
      onRemoveEvent,
      pushToast: toastsPush,
    }),
    [
      apiKey,
      cache,
      eventsForDate,
      navigate,
      runSync,
      openKeyDialog,
      openFilePicker,
      onAddEvent,
      onRemoveEvent,
      toastsPush,
    ],
  );

  const hasData = cache.profile !== null || cache.weeks.length > 0;

  return (
    <ViewerProvider value={ctx}>
      <LiveSessionProvider profile={cache.profile} canTrack={apiKey.canSync} pushToast={toastsPush}>
        <div className="h-screen flex flex-col overflow-hidden bg-background">
          <Header
            profile={cache.profile}
            weekCount={cache.weeks.length}
            totalSeconds={cache.totalSeconds}
            progress={sync.progress}
            canSync={apiKey.canSync}
            syncing={sync.active}
            hasUserKey={apiKey.hasUserKey}
            hasData={hasData}
            fileInputRef={fileInputRef}
            menuOpen={menuOpen}
            onSync={onSync}
            onForceSync={onForceSync}
            onDownloadBackup={onDownloadBackup}
            onOpenKeyDialog={openKeyDialog}
            onOpenIntegrations={() => {
              setMenuOpen(false);
              setIntegrationsOpen(true);
            }}
            onClearCache={onClearCache}
            onMenuToggle={() => setMenuOpen((o) => !o)}
            onMenuClose={() => setMenuOpen(false)}
            onLoadFiles={onLoadFiles}
          />

          {!online ? (
            <div
              role="status"
              className="bg-warn-bg text-warn text-[12.5px] text-center px-4 py-1.5 border-b border-border"
            >
              Offline — je bekijkt gegevens uit de cache; live acties zijn nu niet beschikbaar.
            </div>
          ) : null}

          <ShellTimer hidden={route.view === "today"} />

          <div className="flex flex-1 overflow-hidden">
            <Sidebar
              profile={cache.profile}
              weeks={cache.sortedWeeks}
              activeIso={effectiveActiveIso}
              view={sidebarView}
              onSelectToday={() => navigate(TODAY_HREF)}
              onSelectWeek={(iso) => navigate(weekHref(iso))}
              onSelectProfile={() => navigate(PROFILE_HREF)}
            />

            <main className="vt-main flex-1 overflow-y-auto px-9 py-7">
              {cache.hydrated ? children : null}
            </main>
          </div>

          <ToastTray toasts={toasts.toasts} />
          <ServiceWorkerManager onUpdate={onSwUpdate} />

          <KeyDialog
            open={keyDialogOpen}
            hasEnvKey={apiKey.hasEnvKey === true}
            onClose={() => setKeyDialogOpen(false)}
            onSubmit={onSubmitKey}
          />

          <IntegrationsDialog
            open={integrationsOpen}
            onClose={() => setIntegrationsOpen(false)}
            onProvidersChanged={refreshProviders}
            onToast={onToastFromDialog}
          />
        </div>
      </LiveSessionProvider>
    </ViewerProvider>
  );
}

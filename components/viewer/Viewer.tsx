"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  useApiKey,
  useDayEvents,
  useKeyboardNav,
  useStreamingSync,
  useToasts,
  useViewerCache,
  useViewTransition,
} from "@/hooks";
import { buildBackupFile, downloadBackup, readBackupFiles } from "@/lib/backup";
import { toLocalIsoDate } from "@/lib/format";
import { PROFILE_HREF, TODAY_HREF, dayHref, parseRoute, weekHref } from "@/lib/routing";
import { Header } from "./Header";
import { IntegrationsDialog } from "./integrations";
import { KeyDialog } from "./KeyDialog";
import { ProfileDetail } from "./ProfileDetail";
import { Sidebar, type SidebarView } from "./Sidebar";
import { ToastTray } from "./ToastTray";
import { TodayView } from "./today";
import { Welcome } from "./Welcome";
import { WeekDetail, fullWeekDays } from "./week-detail";
import { DayDetail } from "./day-detail";

/**
 * Top-level orchestrator for the viewer.
 *
 * Owns the cross-cutting UI state (current view, active week, menu/dialog
 * visibility) and wires together the five hook-managed concerns:
 *
 *   - {@link useApiKey}        — key probe + storage,
 *   - {@link useViewerCache}   — profile + weeks (persisted),
 *   - {@link useStreamingSync} — NDJSON sync driver,
 *   - {@link useToasts}        — bottom-right toast queue,
 *   - {@link useDayEvents}     — manual + provider-sourced day events.
 *
 * The active view is derived from the URL (see {@link parseRoute}), so weeks
 * and day-details are deep-linkable and survive refresh / back-forward;
 * navigation is `router.push`. While the cache hydrates, the view falls back
 * to whatever the data can show, keeping hydration free of setState-in-render.
 */
export function Viewer() {
  const apiKey = useApiKey();
  const cache = useViewerCache();
  const sync = useStreamingSync();
  const toasts = useToasts();
  const events = useDayEvents();

  // Destructure stable callbacks from hook APIs so effect dependency
  // arrays don't fire on every render when the wrapper object changes.
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

  // The URL is the source of truth for which view is shown, so weeks and
  // day-details are deep-linkable and survive refresh / back-forward.
  // `navigate` wraps router pushes in a View Transition (see useViewTransition).
  const navigate = useViewTransition();
  const pathname = usePathname();
  const route = useMemo(() => parseRoute(pathname ?? TODAY_HREF), [pathname]);

  // Which week is active: explicit from the URL, else the latest synced week.
  const routeIso = route.view === "week" ? route.isoWeek : null;
  const effectiveActiveIso = routeIso ?? cache.sortedWeeks[0]?.week.isoWeek ?? null;
  const activeWeek = cache.sortedWeeks.find((w) => w.week.isoWeek === effectiveActiveIso) ?? null;
  const dayDate = route.view === "week" ? route.date : null;
  const activeDay = useMemo(
    () =>
      dayDate && activeWeek
        ? (fullWeekDays(activeWeek).find((d) => d.date === dayDate) ?? null)
        : null,
    [dayDate, activeWeek],
  );

  // Map the URL onto a sidebar view. Vandaag (today) is the default landing;
  // the first run, before any key/data, falls back to the welcome screen.
  const effectiveView: SidebarView = useMemo(() => {
    const hasData = cache.weeks.length > 0 || cache.profile !== null;
    if (!hasData) return "empty";
    if (route.view === "profile" && cache.profile) return "profile";
    if (route.view === "week") return "week";
    return "today";
  }, [route.view, cache.weeks.length, cache.profile]);

  // Keep the holiday / ICS provider window aligned with the data we
  // have on screen. Re-runs only when the underlying weeks change.
  useEffect(() => {
    if (cache.sortedWeeks.length === 0) return;
    const newest = cache.sortedWeeks[0];
    const oldest = cache.sortedWeeks[cache.sortedWeeks.length - 1];
    if (newest && oldest) setEventRange(oldest.week.from, newest.week.to);
  }, [cache.sortedWeeks, setEventRange]);

  const onAddEvent = useCallback(
    (date: string, kind: Parameters<typeof addManualEvent>[1]) => {
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
    enabled: effectiveView === "week" && dayDate === null && cache.sortedWeeks.length > 0,
    // `replace` so rapid arrow-stepping doesn't flood history; `animate: false`
    // so quick stepping stays snappy rather than queuing cross-fades.
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
    async (force: boolean) => {
      if (!apiKey.canSync) {
        setKeyDialogOpen(true);
        return;
      }

      // Profile + weeks are written straight into the query cache by the sync
      // mutation as events stream in; no onProfile/onWeek wiring needed. The
      // home view auto-shows the latest week, and an explicit week URL is
      // left untouched.
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

  const onOpenIntegrations = useCallback(() => {
    setMenuOpen(false);
    setIntegrationsOpen(true);
  }, []);

  const onOpenKeyDialog = useCallback(() => {
    setMenuOpen(false);
    setKeyDialogOpen(true);
  }, []);

  const onToastFromDialog = useCallback(
    (message: string, kind: "good" | "error") => toastsPush(message, kind),
    [toastsPush],
  );

  const hasData = cache.profile !== null || cache.weeks.length > 0;
  // Defer the welcome-vs-data decision until the persisted cache has restored,
  // so a returning user never flashes the onboarding screen on a cold load.
  const showWelcome = cache.hydrated && effectiveView === "empty";

  return (
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
        onOpenKeyDialog={onOpenKeyDialog}
        onOpenIntegrations={onOpenIntegrations}
        onClearCache={onClearCache}
        onMenuToggle={() => setMenuOpen((o) => !o)}
        onMenuClose={() => setMenuOpen(false)}
        onLoadFiles={onLoadFiles}
      />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          profile={cache.profile}
          weeks={cache.sortedWeeks}
          activeIso={effectiveActiveIso}
          view={effectiveView}
          onSelectToday={() => navigate(TODAY_HREF)}
          onSelectWeek={(iso) => navigate(weekHref(iso))}
          onSelectProfile={() => navigate(PROFILE_HREF)}
        />

        <main className="vt-main flex-1 overflow-y-auto px-9 py-7">
          {!cache.hydrated ? null : showWelcome ? (
            <Welcome
              hasUserKey={apiKey.hasUserKey}
              hasEnvKey={apiKey.hasEnvKey === true}
              onEnterKey={onOpenKeyDialog}
              onSync={() => runSync(false)}
              onLoad={() => fileInputRef.current?.click()}
            />
          ) : effectiveView === "today" ? (
            <TodayView
              apiKey={apiKey.readUserKey()}
              canTrack={apiKey.canSync}
              profile={cache.profile}
              weeks={cache.weeks}
              onEnterKey={onOpenKeyDialog}
              onSync={() => runSync(false)}
            />
          ) : effectiveView === "profile" && cache.profile ? (
            <ProfileDetail profile={cache.profile} />
          ) : effectiveView === "week" && activeWeek ? (
            dayDate && activeDay ? (
              <DayDetail
                week={activeWeek}
                day={activeDay}
                events={eventsForDate?.(dayDate)}
                tzOffsetHours={cache.profile?.timezone ?? null}
                onBack={() => navigate(weekHref(activeWeek.week.isoWeek))}
              />
            ) : (
              <WeekDetail
                week={activeWeek}
                eventsForDate={eventsForDate}
                onAddEvent={onAddEvent}
                onRemoveEvent={onRemoveEvent}
                onOpenDay={(date) => navigate(dayHref(activeWeek.week.isoWeek, date))}
              />
            )
          ) : (
            <div className="text-muted">Selecteer een week in de zijbalk.</div>
          )}
        </main>
      </div>

      <ToastTray toasts={toasts.toasts} />

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
  );
}

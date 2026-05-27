"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  useApiKey,
  useDayEvents,
  useKeyboardNav,
  useStreamingSync,
  useToasts,
  useViewerCache,
} from "@/hooks";
import { buildBackupFile, downloadBackup, readBackupFiles } from "@/lib/backup";
import { Header } from "./Header";
import { IntegrationsDialog } from "./integrations";
import { KeyDialog } from "./KeyDialog";
import { ProfileDetail } from "./ProfileDetail";
import { Sidebar, type SidebarView } from "./Sidebar";
import { ToastTray } from "./ToastTray";
import { Welcome } from "./Welcome";
import { WeekDetail } from "./week-detail";

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
 * The `view` state uses `"empty"` as a "let the data decide" sentinel
 * rather than a literal empty screen — once the cache has data the
 * displayed view is derived. This keeps initial hydration free of any
 * setState-in-render, which React 19 forbids.
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

  const [view, setView] = useState<SidebarView>("empty");
  const [activeIso, setActiveIso] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [keyDialogOpen, setKeyDialogOpen] = useState(false);
  const [integrationsOpen, setIntegrationsOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Derived view: respects an explicit user pick, otherwise auto-selects
  // based on cache contents. No setState-in-render.
  const effectiveView: SidebarView = useMemo(() => {
    if (view !== "empty") return view;
    if (cache.weeks.length > 0) return "week";
    if (cache.profile) return "profile";
    return "empty";
  }, [view, cache.weeks.length, cache.profile]);

  const effectiveActiveIso = activeIso ?? cache.sortedWeeks[0]?.week.isoWeek ?? null;
  const activeWeek = cache.sortedWeeks.find((w) => w.week.isoWeek === effectiveActiveIso) ?? null;

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
    enabled: effectiveView === "week" && cache.sortedWeeks.length > 0,
    onPrev: () => {
      const idx = cache.sortedWeeks.findIndex((w) => w.week.isoWeek === effectiveActiveIso);
      const next = cache.sortedWeeks[Math.max(0, idx - 1)];
      if (next) setActiveIso(next.week.isoWeek);
    },
    onNext: () => {
      const idx = cache.sortedWeeks.findIndex((w) => w.week.isoWeek === effectiveActiveIso);
      const next = cache.sortedWeeks[Math.min(cache.sortedWeeks.length - 1, idx + 1)];
      if (next) setActiveIso(next.week.isoWeek);
    },
  });

  const runSync = useCallback(
    async (force: boolean) => {
      if (!apiKey.canSync) {
        setKeyDialogOpen(true);
        return;
      }
      let firstWeekSeen = cache.weeks.length > 0;

      await sync.run({
        apiKey: apiKey.readUserKey(),
        force,
        knownWeeks: cache.weeks.map((w) => ({
          isoWeek: w.week.isoWeek,
          status: w.approval.status,
        })),
        onProfile: (profile) => cache.setProfile(profile),
        onWeek: (week) => {
          cache.upsertWeek(week);
          if (!firstWeekSeen) {
            firstWeekSeen = true;
            setActiveIso(week.week.isoWeek);
            setView("week");
          }
        },
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
    downloadBackup(`everhour-backup-${new Date().toISOString().slice(0, 10)}.json`, backup);
    toastsPush(`Backup gedownload (${cache.weeks.length} weken)`, "good");
  }, [cache.profile, cache.weeks, toastsPush]);

  const onClearCache = useCallback(() => {
    setMenuOpen(false);
    if (!confirm("Lokale gegevens wissen? Je API-sleutel blijft bewaard.")) return;
    cache.clear();
    setActiveIso(null);
    setView("empty");
    toastsPush("Cache gewist", "good");
  }, [cache, toastsPush]);

  const onLoadFiles = useCallback(
    async (files: FileList) => {
      const loaded = await readBackupFiles(Array.from(files));
      if (!loaded.hasWeeks && !loaded.hasProfile) return;
      if (loaded.hasProfile) cache.setProfile(loaded.profile);
      if (loaded.hasWeeks) cache.upsertWeeks(loaded.weeks);
      if (loaded.hasWeeks && activeIso === null) {
        const next = [...loaded.weeks].sort((a, b) => b.week.from.localeCompare(a.week.from))[0];
        if (next) {
          setActiveIso(next.week.isoWeek);
          setView("week");
        }
      } else if (loaded.hasProfile && !loaded.hasWeeks) {
        setView("profile");
      }
      const parts: string[] = [];
      if (loaded.hasProfile) parts.push("profiel");
      if (loaded.hasWeeks) {
        parts.push(`${loaded.weeks.length} ${loaded.weeks.length === 1 ? "week" : "weken"}`);
      }
      toastsPush(`Geladen: ${parts.join(" + ")}`, "good");
    },
    [cache, activeIso, toastsPush],
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
  const showWelcome = effectiveView === "empty";

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-background">
      <Header
        profile={cache.profile}
        weekCount={cache.weeks.length}
        totalHours={cache.totalHours}
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
          onSelectWeek={(iso) => {
            setActiveIso(iso);
            setView("week");
          }}
          onSelectProfile={() => setView("profile")}
        />

        <main className="flex-1 overflow-y-auto px-9 py-7">
          {showWelcome ? (
            <Welcome
              hasUserKey={apiKey.hasUserKey}
              hasEnvKey={apiKey.hasEnvKey === true}
              onEnterKey={onOpenKeyDialog}
              onSync={() => runSync(false)}
              onLoad={() => fileInputRef.current?.click()}
            />
          ) : effectiveView === "profile" && cache.profile ? (
            <ProfileDetail profile={cache.profile} />
          ) : effectiveView === "week" && activeWeek ? (
            <WeekDetail
              week={activeWeek}
              eventsForDate={eventsForDate}
              onAddEvent={onAddEvent}
              onRemoveEvent={onRemoveEvent}
            />
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

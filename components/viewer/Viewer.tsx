"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
 * Owns the cross-cutting state (current view, active week, menu/dialog
 * visibility) and wires together the four hook-managed concerns:
 *
 *   - {@link useApiKey}        — key probe + storage,
 *   - {@link useViewerCache}   — profile + weeks (persisted),
 *   - {@link useStreamingSync} — NDJSON sync driver,
 *   - {@link useToasts}        — bottom-right toast queue.
 *
 * Everything visible on screen is rendered by a child component; this
 * file is purely composition.
 */
export function Viewer() {
  const apiKey = useApiKey();
  const cache = useViewerCache();
  const sync = useStreamingSync();
  const toasts = useToasts();
  const events = useDayEvents();

  const [view, setView] = useState<SidebarView>("empty");
  const [activeIso, setActiveIso] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [keyDialogOpen, setKeyDialogOpen] = useState(false);
  const [integrationsOpen, setIntegrationsOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Once the cache has hydrated, pick a sensible initial view.
  if (cache.hydrated && view === "empty") {
    if (cache.weeks.length > 0) {
      setView("week");
      if (!activeIso) setActiveIso(cache.sortedWeeks[0]?.week.isoWeek ?? null);
    } else if (cache.profile) {
      setView("profile");
    }
  }

  const activeWeek =
    cache.sortedWeeks.find((w) => w.week.isoWeek === activeIso) ?? cache.sortedWeeks[0] ?? null;

  // Keep the holiday provider window aligned with the data we have on screen.
  useEffect(() => {
    if (cache.sortedWeeks.length === 0) return;
    const newest = cache.sortedWeeks[0];
    const oldest = cache.sortedWeeks[cache.sortedWeeks.length - 1];
    if (newest && oldest) events.setRange(oldest.week.from, newest.week.to);
  }, [cache.sortedWeeks, events]);

  const onAddEvent = useCallback(
    (date: string, kind: Parameters<typeof events.addManual>[1]) => {
      const ev = events.addManual(date, kind);
      toasts.push(`${ev.label} toegevoegd op ${date}`, "good");
    },
    [events, toasts],
  );

  const onRemoveEvent = useCallback(
    (id: string) => {
      events.removeManual(id);
      toasts.push("Event verwijderd", "good");
    },
    [events, toasts],
  );

  useKeyboardNav({
    enabled: view === "week" && cache.sortedWeeks.length > 0,
    onPrev: () => {
      const idx = cache.sortedWeeks.findIndex((w) => w.week.isoWeek === activeIso);
      const next = cache.sortedWeeks[Math.max(0, idx - 1)];
      if (next) setActiveIso(next.week.isoWeek);
    },
    onNext: () => {
      const idx = cache.sortedWeeks.findIndex((w) => w.week.isoWeek === activeIso);
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
          toasts.push(
            `Sync klaar — ${counts.new} nieuw · ${counts.updated} bijgewerkt · ${counts.skipped} ongewijzigd`,
            "good",
          );
        },
        onError: (message) => toasts.push(`Sync mislukt: ${message}`, "error"),
      });
    },
    [apiKey, cache, sync, toasts],
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
      toasts.push("Niets om te exporteren", "error");
      return;
    }
    const backup = buildBackupFile(cache.profile, cache.weeks);
    downloadBackup(`everhour-backup-${new Date().toISOString().slice(0, 10)}.json`, backup);
    toasts.push(`Backup gedownload (${cache.weeks.length} weken)`, "good");
  }, [cache, toasts]);

  const onClearCache = useCallback(() => {
    setMenuOpen(false);
    if (!confirm("Lokale gegevens wissen? Je API-sleutel blijft bewaard.")) return;
    cache.clear();
    setActiveIso(null);
    setView("empty");
    toasts.push("Cache gewist", "good");
  }, [cache, toasts]);

  const onLoadFiles = useCallback(
    async (files: FileList) => {
      const loaded = await readBackupFiles(Array.from(files));
      if (!loaded.hasWeeks && !loaded.hasProfile) return;
      if (loaded.hasProfile) cache.setProfile(loaded.profile);
      if (loaded.hasWeeks) cache.upsertWeeks(loaded.weeks);
      if (loaded.hasWeeks && !activeIso) {
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
      toasts.push(`Geladen: ${parts.join(" + ")}`, "good");
    },
    [cache, activeIso, toasts],
  );

  const onSubmitKey = useCallback(
    (value: string) => {
      apiKey.setUserKey(value);
      setKeyDialogOpen(false);
      toasts.push(value ? "API-sleutel opgeslagen" : "API-sleutel verwijderd", "good");
    },
    [apiKey, toasts],
  );

  const showEmpty = !cache.profile && cache.weeks.length === 0;
  const hasData = !!cache.profile || cache.weeks.length > 0;

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[var(--background)]">
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
        onOpenKeyDialog={() => {
          setMenuOpen(false);
          setKeyDialogOpen(true);
        }}
        onOpenIntegrations={() => {
          setMenuOpen(false);
          setIntegrationsOpen(true);
        }}
        onClearCache={onClearCache}
        onMenuToggle={() => setMenuOpen((o) => !o)}
        onMenuClose={() => setMenuOpen(false)}
        onLoadFiles={onLoadFiles}
      />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          profile={cache.profile}
          weeks={cache.sortedWeeks}
          activeIso={activeIso}
          view={view}
          onSelectWeek={(iso) => {
            setActiveIso(iso);
            setView("week");
          }}
          onSelectProfile={() => setView("profile")}
        />

        <main className="flex-1 overflow-y-auto px-9 py-7">
          {showEmpty ? (
            <Welcome
              hasUserKey={apiKey.hasUserKey}
              hasEnvKey={apiKey.hasEnvKey === true}
              onEnterKey={() => setKeyDialogOpen(true)}
              onSync={() => runSync(false)}
              onLoad={() => fileInputRef.current?.click()}
            />
          ) : view === "profile" && cache.profile ? (
            <ProfileDetail profile={cache.profile} />
          ) : view === "week" && activeWeek ? (
            <WeekDetail
              week={activeWeek}
              eventsForDate={events.forDate}
              onAddEvent={onAddEvent}
              onRemoveEvent={onRemoveEvent}
            />
          ) : (
            <div className="text-[var(--muted)]">Selecteer een week in de zijbalk.</div>
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
        onProvidersChanged={events.refreshProviders}
        onToast={(message, kind) => toasts.push(message, kind)}
      />
    </div>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { EverhourProfile, WeekDay, WeekRecord } from "@/lib/everhour";

const STORAGE_KEY = "everhour_viewer_data_v1";
const KEY_STORAGE = "everhour_api_key";

const NL_WEEKDAY = ["zondag", "maandag", "dinsdag", "woensdag", "donderdag", "vrijdag", "zaterdag"];
const NL_MONTH_SHORT = ["jan", "feb", "mrt", "apr", "mei", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];

const fmtH = (s: number) => (s / 3600).toFixed(2);
const parseDate = (iso: string) => new Date(iso + "T00:00:00");
const fmtDate = (iso: string) => {
  const d = parseDate(iso);
  return `${String(d.getDate()).padStart(2, "0")} ${NL_MONTH_SHORT[d.getMonth()]}`;
};
const fmtFullDate = (iso: string) => {
  const d = parseDate(iso);
  return `${String(d.getDate()).padStart(2, "0")} ${NL_MONTH_SHORT[d.getMonth()]} ${d.getFullYear()}`;
};
const nlWeekday = (iso: string) => NL_WEEKDAY[parseDate(iso).getDay()];
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const statusLabel: Record<string, string> = {
  pending: "in afwachting",
  approved: "goedgekeurd",
  rejected: "afgekeurd",
  unsubmitted: "open",
};

type Toast = { id: number; msg: string; kind?: "good" | "error" };
type View = "empty" | "profile" | "week";

type Cache = { profile: EverhourProfile | null; weeks: WeekRecord[] };

type SyncEvent =
  | { type: "profile"; profile: EverhourProfile }
  | { type: "plan"; total: number; toFetch: number; toSkip: number }
  | { type: "week"; week: WeekRecord; current: number; total: number; kind: "new" | "updated" }
  | { type: "skip"; isoWeek: string }
  | { type: "done"; counts: { new: number; updated: number; skipped: number; totalWeeks: number } }
  | { type: "error"; message: string; status?: number };

type SyncProgress = {
  phase: "connecting" | "profile" | "list" | "weeks" | "done";
  current: number;
  total: number;
  message: string;
  counts?: { new: number; updated: number; skipped: number };
};

function StatusPill({ status }: { status: string }) {
  return <span className={`status-pill ${status}`}>{statusLabel[status] ?? status}</span>;
}

export default function Viewer() {
  const [profile, setProfile] = useState<EverhourProfile | null>(null);
  const [weeks, setWeeks] = useState<WeekRecord[]>([]);
  const [view, setView] = useState<View>("empty");
  const [activeIso, setActiveIso] = useState<string | null>(null);
  const [progress, setProgress] = useState<SyncProgress | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [keyDialogOpen, setKeyDialogOpen] = useState(false);
  const [hasEnvKey, setHasEnvKey] = useState<boolean | null>(null);
  const [hasUserKey, setHasUserKey] = useState<boolean>(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const pickerRef = useRef<HTMLInputElement>(null);

  const toast = useCallback((msg: string, kind?: "good" | "error") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, msg, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === "error" ? 5500 : 2500);
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw) as Cache;
        if (data.profile) setProfile(data.profile);
        if (Array.isArray(data.weeks)) setWeeks(data.weeks);
        if (data.weeks?.length) {
          const sorted = [...data.weeks].sort((a, b) => b.week.from.localeCompare(a.week.from));
          setActiveIso(sorted[0].week.isoWeek);
          setView("week");
        } else if (data.profile) {
          setView("profile");
        }
      }
    } catch {
      // ignore corrupted cache
    }
    setHasUserKey(!!localStorage.getItem(KEY_STORAGE));
    fetch("/api/sync")
      .then((r) => r.json())
      .then((d: { hasEnvKey: boolean }) => setHasEnvKey(d.hasEnvKey))
      .catch(() => setHasEnvKey(false));
  }, []);

  const persist = useCallback((p: EverhourProfile | null, w: WeekRecord[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ profile: p, weeks: w }));
    } catch {
      // localStorage may be full; non-fatal
    }
  }, []);

  const sortedWeeks = useMemo(() => [...weeks].sort((a, b) => b.week.from.localeCompare(a.week.from)), [weeks]);

  const activeWeek = useMemo(
    () => sortedWeeks.find((w) => w.week.isoWeek === activeIso) ?? sortedWeeks[0] ?? null,
    [sortedWeeks, activeIso],
  );

  const canSync = hasUserKey || hasEnvKey === true;

  async function runSync(force = false) {
    if (!canSync) {
      setKeyDialogOpen(true);
      return;
    }
    const overrideKey = localStorage.getItem(KEY_STORAGE)?.trim();
    setProgress({ phase: "connecting", current: 0, total: 0, message: "Verbinden met Everhour…" });

    let mergedProfile: EverhourProfile | null = profile;
    const mergedMap = new Map<string, WeekRecord>(weeks.map((w) => [w.week.isoWeek, w]));

    try {
      const resp = await fetch("/api/sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(overrideKey ? { "x-everhour-key": overrideKey } : {}),
        },
        body: JSON.stringify({
          weeksBack: 78,
          force,
          knownWeeks: weeks.map((w) => ({ isoWeek: w.week.isoWeek, status: w.approval.status })),
        }),
      });

      if (!resp.ok || !resp.body) {
        let errMsg = `HTTP ${resp.status}`;
        try {
          const j = await resp.json();
          if (j?.error === "no_api_key") errMsg = "Geen API-sleutel ingesteld.";
          else if (j?.error) errMsg = j.error;
        } catch {}
        throw new Error(errMsg);
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let counts = { new: 0, updated: 0, skipped: 0 };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          let event: SyncEvent;
          try {
            event = JSON.parse(line) as SyncEvent;
          } catch {
            continue;
          }
          if (event.type === "profile") {
            mergedProfile = event.profile;
            setProfile(event.profile);
            setProgress({ phase: "list", current: 0, total: 0, message: `Hallo ${event.profile.name} — weekoverzicht ophalen…` });
          } else if (event.type === "plan") {
            counts = { ...counts, skipped: event.toSkip };
            if (event.toFetch === 0) {
              setProgress({ phase: "weeks", current: 0, total: 0, message: `Niets nieuw — ${event.toSkip} weken al up-to-date.`, counts });
            } else {
              setProgress({ phase: "weeks", current: 0, total: event.toFetch, message: `${event.toFetch} weken te verwerken (${event.toSkip} overgeslagen).`, counts });
            }
          } else if (event.type === "week") {
            const isFirstWeek = mergedMap.size === 0 && weeks.length === 0;
            mergedMap.set(event.week.week.isoWeek, event.week);
            counts = {
              ...counts,
              new: counts.new + (event.kind === "new" ? 1 : 0),
              updated: counts.updated + (event.kind === "updated" ? 1 : 0),
            };
            setWeeks([...mergedMap.values()]);
            if (isFirstWeek) {
              setActiveIso(event.week.week.isoWeek);
              setView("week");
            }
            setProgress({
              phase: "weeks",
              current: event.current,
              total: event.total,
              message: `Week ${event.current}/${event.total}: ${event.week.week.isoWeek} (${fmtH(event.week.totals.seconds)}u)`,
              counts,
            });
          } else if (event.type === "done") {
            setProgress({ phase: "done", current: counts.new + counts.updated, total: counts.new + counts.updated, message: "Klaar.", counts: event.counts });
          } else if (event.type === "error") {
            throw new Error(event.message);
          }
        }
      }

      const finalWeeks = [...mergedMap.values()];
      setWeeks(finalWeeks);
      persist(mergedProfile, finalWeeks);
      if (finalWeeks.length) {
        const sorted = [...finalWeeks].sort((a, b) => b.week.from.localeCompare(a.week.from));
        setActiveIso((cur) => cur ?? sorted[0].week.isoWeek);
        setView((cur) => (cur === "empty" ? "week" : cur));
      } else if (mergedProfile) {
        setView("profile");
      }
      const summary = `${counts.new} nieuw · ${counts.updated} bijgewerkt · ${counts.skipped} ongewijzigd`;
      toast(`Sync klaar — ${summary}`, "good");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast("Sync mislukt: " + msg, "error");
    } finally {
      setTimeout(() => setProgress(null), 1500);
    }
  }

  function clearAll() {
    if (!confirm("Lokale gegevens wissen? Je API-sleutel blijft bewaard.")) return;
    localStorage.removeItem(STORAGE_KEY);
    setProfile(null);
    setWeeks([]);
    setActiveIso(null);
    setView("empty");
    toast("Cache gewist", "good");
  }

  function downloadBackup() {
    if (!profile && weeks.length === 0) {
      toast("Niets om te exporteren", "error");
      return;
    }
    const payload = {
      schemaVersion: 1 as const,
      exportedAt: new Date().toISOString(),
      profile,
      weeks: sortedWeeks,
      index: sortedWeeks.map((w) => ({
        isoWeek: w.week.isoWeek,
        weekId: w.week.weekId,
        from: w.week.from,
        to: w.week.to,
        hours: w.totals.hours,
        status: w.approval.status,
        submittedAt: w.approval.submittedAt,
      })),
    };
    const json = JSON.stringify(payload, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `everhour-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast(`Backup gedownload (${weeks.length} weken)`, "good");
  }

  async function loadFiles(files: FileList | File[]) {
    let nextProfile = profile;
    const map = new Map<string, WeekRecord>(weeks.map((w) => [w.week.isoWeek, w]));
    let loadedWeeks = 0;
    let loadedProfile = false;

    for (const f of Array.from(files)) {
      if (!f.name.endsWith(".json")) continue;
      try {
        const data = JSON.parse(await f.text());
        if (f.name === "profile.json" || (data.role !== undefined && data.email !== undefined && data.weeks === undefined)) {
          nextProfile = data as EverhourProfile;
          loadedProfile = true;
          continue;
        }
        if (f.name === "index.json") continue;
        if (data.profile && Array.isArray(data.weeks)) {
          nextProfile = data.profile;
          loadedProfile = true;
          for (const w of data.weeks as WeekRecord[]) {
            map.set(w.week.isoWeek, w);
            loadedWeeks++;
          }
          continue;
        }
        if (data.week && data.days) {
          const w = data as WeekRecord;
          map.set(w.week.isoWeek, w);
          loadedWeeks++;
        }
      } catch (e) {
        console.error("Cannot load", f.name, e);
      }
    }

    const nextWeeks = [...map.values()];
    setProfile(nextProfile);
    setWeeks(nextWeeks);
    persist(nextProfile, nextWeeks);

    if (nextWeeks.length) {
      const sorted = [...nextWeeks].sort((a, b) => b.week.from.localeCompare(a.week.from));
      setActiveIso((cur) => cur ?? sorted[0].week.isoWeek);
      setView("week");
    } else if (loadedProfile) {
      setView("profile");
    }

    if (loadedWeeks || loadedProfile) {
      const parts: string[] = [];
      if (loadedProfile) parts.push("profiel");
      if (loadedWeeks) parts.push(`${loadedWeeks} ${loadedWeeks === 1 ? "week" : "weken"}`);
      toast(`Geladen: ${parts.join(" + ")}`, "good");
    }
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      if (t && (t.matches("input, textarea") || t.tagName === "SUMMARY")) return;
      if (view !== "week" || sortedWeeks.length === 0) return;
      const i = sortedWeeks.findIndex((w) => w.week.isoWeek === activeIso);
      if (e.key === "ArrowDown" || e.key === "j") {
        e.preventDefault();
        const next = sortedWeeks[Math.min(sortedWeeks.length - 1, i + 1)];
        if (next) setActiveIso(next.week.isoWeek);
      } else if (e.key === "ArrowUp" || e.key === "k") {
        e.preventDefault();
        const next = sortedWeeks[Math.max(0, i - 1)];
        if (next) setActiveIso(next.week.isoWeek);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [view, activeIso, sortedWeeks]);

  useEffect(() => {
    if (!menuOpen) return;
    function onDown(e: MouseEvent) {
      const t = e.target as HTMLElement;
      if (!t.closest("[data-menu]")) setMenuOpen(false);
    }
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [menuOpen]);

  const totalHours = useMemo(() => weeks.reduce((acc, w) => acc + w.totals.seconds, 0) / 3600, [weeks]);
  const syncing = progress !== null && progress.phase !== "done";
  const showEmpty = !profile && weeks.length === 0;

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[var(--background)]">
      <header className="px-5 h-14 bg-[var(--panel)] border-b border-[var(--border)] flex items-center gap-3 flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <Logo />
          <span className="font-semibold text-[15px] tracking-tight">Everhour viewer</span>
        </div>

        <div className="flex-1 min-w-0 px-4">
          {progress ? (
            <ProgressBar progress={progress} />
          ) : (
            <span className="text-[var(--muted)] text-[13px] truncate">
              {profile
                ? `${profile.name} · ${weeks.length} ${weeks.length === 1 ? "week" : "weken"} · ${totalHours.toFixed(1)}u totaal`
                : weeks.length
                  ? `${weeks.length} weken · ${totalHours.toFixed(1)}u totaal`
                  : "Geen gegevens geladen"}
            </span>
          )}
        </div>

        <input
          ref={pickerRef}
          type="file"
          multiple
          accept=".json"
          aria-label="Laad een eerder gedownloade backup"
          className="hidden"
          onChange={(e) => e.target.files && loadFiles(e.target.files)}
        />

        <Button
          primary
          disabled={syncing || !canSync}
          onClick={() => runSync(false)}
          title={!canSync ? "Stel eerst een API-sleutel in" : "Haal nieuwe en gewijzigde weken op"}
        >
          {syncing ? "Bezig…" : "Synchroniseer"}
        </Button>

        <div className="relative" data-menu>
          <Button onClick={() => setMenuOpen((o) => !o)} aria-label="Menu">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="3" cy="8" r="1.2" fill="currentColor" />
              <circle cx="8" cy="8" r="1.2" fill="currentColor" />
              <circle cx="13" cy="8" r="1.2" fill="currentColor" />
            </svg>
          </Button>
          {menuOpen && (
            <div className="absolute right-0 top-full mt-1.5 min-w-[220px] bg-[var(--panel)] border border-[var(--border)] rounded-lg shadow-lg z-40 py-1.5 overflow-hidden">
              <MenuItem
                onClick={() => {
                  setMenuOpen(false);
                  runSync(true);
                }}
                disabled={!canSync || syncing}
              >
                Forceer volledige sync
              </MenuItem>
              <MenuItem
                onClick={() => {
                  setMenuOpen(false);
                  downloadBackup();
                }}
                disabled={!profile && weeks.length === 0}
              >
                Backup downloaden
              </MenuItem>
              <MenuItem
                onClick={() => {
                  setMenuOpen(false);
                  pickerRef.current?.click();
                }}
              >
                Backup laden…
              </MenuItem>
              <MenuDivider />
              <MenuItem
                onClick={() => {
                  setMenuOpen(false);
                  setKeyDialogOpen(true);
                }}
              >
                API-sleutel{hasUserKey ? " wijzigen" : " instellen"}
              </MenuItem>
              <MenuItem
                onClick={() => {
                  setMenuOpen(false);
                  clearAll();
                }}
                danger
                disabled={!profile && weeks.length === 0}
              >
                Cache wissen
              </MenuItem>
            </div>
          )}
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          profile={profile}
          weeks={sortedWeeks}
          activeIso={activeIso}
          view={view}
          onSelectWeek={(iso) => {
            setActiveIso(iso);
            setView("week");
          }}
          onSelectProfile={() => setView("profile")}
        />
        <main className="flex-1 overflow-y-auto">
          {showEmpty ? (
            <Welcome
              hasUserKey={hasUserKey}
              hasEnvKey={hasEnvKey === true}
              onEnterKey={() => setKeyDialogOpen(true)}
              onSync={() => runSync(false)}
              onLoad={() => pickerRef.current?.click()}
            />
          ) : view === "profile" && profile ? (
            <div className="px-9 py-7"><ProfileDetail profile={profile} /></div>
          ) : view === "week" && activeWeek ? (
            <div className="px-9 py-7"><WeekDetail week={activeWeek} /></div>
          ) : (
            <div className="px-9 py-7 text-[var(--muted)]">Selecteer een week in de zijbalk.</div>
          )}
        </main>
      </div>

      <div className="fixed bottom-5 right-5 flex flex-col gap-2 z-50">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`px-4 py-2.5 rounded-lg text-[13px] text-white shadow-lg max-w-sm animate-fade-in ${
              t.kind === "error" ? "bg-[var(--bad)]" : t.kind === "good" ? "bg-[var(--good)]" : "bg-[var(--foreground)]"
            }`}
          >
            {t.msg}
          </div>
        ))}
      </div>

      {keyDialogOpen && (
        <KeyDialog
          hasEnvKey={hasEnvKey === true}
          onClose={() => setKeyDialogOpen(false)}
          onSaved={(value) => {
            setKeyDialogOpen(false);
            setHasUserKey(!!value);
            toast(value ? "API-sleutel opgeslagen" : "API-sleutel verwijderd", "good");
          }}
        />
      )}
    </div>
  );
}

function Logo() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
      <circle cx="11" cy="11" r="9" stroke="var(--accent)" strokeWidth="1.6" />
      <path d="M11 6V11L14.5 13" stroke="var(--accent)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ProgressBar({ progress }: { progress: SyncProgress }) {
  const pct = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : progress.phase === "done" ? 100 : 0;
  const indeterminate = progress.total === 0 && progress.phase !== "done";
  return (
    <div className="flex items-center gap-3">
      <div className="text-[12px] text-[var(--muted)] truncate min-w-0 flex-shrink-0 max-w-[420px]">{progress.message}</div>
      <div className="relative flex-1 h-1.5 bg-[var(--border)] rounded-full overflow-hidden max-w-[280px]">
        {indeterminate ? (
          <div className="absolute inset-y-0 w-1/3 bg-[var(--accent)] rounded-full animate-progress-indeterminate" />
        ) : (
          <div
            className="absolute inset-y-0 left-0 bg-[var(--accent)] rounded-full transition-all duration-200"
            style={{ width: `${pct}%` }}
          />
        )}
      </div>
      {progress.counts && (
        <div className="text-[11px] text-[var(--muted)] tabular-nums whitespace-nowrap">
          <span className="text-[var(--good)] font-medium">{progress.counts.new}</span> nieuw ·{" "}
          <span className="text-[var(--accent)] font-medium">{progress.counts.updated}</span> bijgewerkt ·{" "}
          <span>{progress.counts.skipped}</span> ongewijzigd
        </div>
      )}
    </div>
  );
}

function Button({
  children,
  onClick,
  primary,
  disabled,
  title,
  small,
  ...rest
}: {
  children: React.ReactNode;
  onClick?: () => void;
  primary?: boolean;
  disabled?: boolean;
  title?: string;
  small?: boolean;
  "aria-label"?: string;
}) {
  const base = `${small ? "px-2.5 py-1 text-[12px]" : "px-3 py-1.5 text-[13px]"} rounded-md font-medium border transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer inline-flex items-center gap-1.5`;
  const styles = primary
    ? `${base} bg-[var(--accent)] text-white border-[var(--accent)] hover:brightness-110`
    : `${base} bg-[var(--panel)] border-[var(--border)] hover:bg-[var(--hover)]`;
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={styles} title={title} {...rest}>
      {children}
    </button>
  );
}

function MenuItem({
  children,
  onClick,
  disabled,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`w-full text-left px-3.5 py-2 text-[13px] disabled:opacity-40 disabled:cursor-not-allowed ${
        danger ? "text-[var(--bad)] hover:bg-[var(--bad-bg)]" : "hover:bg-[var(--hover)]"
      }`}
    >
      {children}
    </button>
  );
}

function MenuDivider() {
  return <div className="border-t border-[var(--border)] my-1" />;
}

function Welcome({
  hasUserKey,
  hasEnvKey,
  onEnterKey,
  onSync,
  onLoad,
}: {
  hasUserKey: boolean;
  hasEnvKey: boolean;
  onEnterKey: () => void;
  onSync: () => void;
  onLoad: () => void;
}) {
  const canSync = hasUserKey || hasEnvKey;
  return (
    <div className="flex flex-col items-center justify-center min-h-full px-6 py-12">
      <div className="max-w-md w-full">
        <h2 className="text-[22px] font-semibold mb-2 text-center">Welkom</h2>
        <p className="text-[var(--muted)] text-[14px] mb-7 text-center">
          Bekijk je Everhour tijdsregistraties lokaal. Je gegevens blijven in deze browser bewaard — niets wordt gedeeld.
        </p>

        <div className="bg-[var(--panel)] border border-[var(--border)] rounded-xl p-5 mb-3">
          <Step
            n={1}
            title="Voeg je API-sleutel toe"
            done={canSync}
            description={
              hasEnvKey && !hasUserKey
                ? "Een dev-sleutel is geconfigureerd. Je kunt direct synchroniseren."
                : "Je sleutel wordt alleen in deze browser bewaard en bij elke sync naar de server gestuurd."
            }
            action={
              <Button primary={!canSync} onClick={onEnterKey} small>
                {hasUserKey ? "Sleutel wijzigen" : "Sleutel instellen"}
              </Button>
            }
          />
          <div className="border-t border-[var(--border)] my-3" />
          <Step
            n={2}
            title="Synchroniseer"
            description="Haalt profiel en de laatste 78 weken op. Volgende sync is incrementeel."
            action={
              <Button primary={canSync} disabled={!canSync} onClick={onSync} small>
                Synchroniseer
              </Button>
            }
          />
        </div>

        <div className="text-center text-[12px] text-[var(--muted)]">
          Heb je al een eerdere backup?{" "}
          <button type="button" onClick={onLoad} className="text-[var(--accent)] hover:underline">
            Laad een JSON-bestand
          </button>
        </div>
      </div>
    </div>
  );
}

function Step({
  n,
  title,
  description,
  action,
  done,
}: {
  n: number;
  title: string;
  description: React.ReactNode;
  action: React.ReactNode;
  done?: boolean;
}) {
  return (
    <div className="flex gap-3.5 items-start">
      <div
        className={`mt-0.5 w-6 h-6 rounded-full flex items-center justify-center text-[12px] font-semibold flex-shrink-0 ${
          done ? "bg-[var(--good-bg)] text-[var(--good)]" : "bg-[var(--accent-bg)] text-[var(--accent)]"
        }`}
      >
        {done ? "✓" : n}
      </div>
      <div className="flex-1">
        <div className="font-medium text-[14px] mb-0.5">{title}</div>
        <div className="text-[12.5px] text-[var(--muted)] mb-2.5 leading-relaxed">{description}</div>
        <div>{action}</div>
      </div>
    </div>
  );
}

function Sidebar({
  profile,
  weeks,
  activeIso,
  view,
  onSelectWeek,
  onSelectProfile,
}: {
  profile: EverhourProfile | null;
  weeks: WeekRecord[];
  activeIso: string | null;
  view: View;
  onSelectWeek: (iso: string) => void;
  onSelectProfile: () => void;
}) {
  if (!profile && weeks.length === 0) return null;
  return (
    <aside className="w-[300px] bg-[var(--panel)] border-r border-[var(--border)] overflow-hidden flex-shrink-0 flex flex-col">
      {profile && (
        <button
          type="button"
          onClick={onSelectProfile}
          className={`px-4 py-3 border-b border-[var(--border)] flex items-center gap-3 cursor-pointer select-none hover:bg-[var(--hover)] text-left ${
            view === "profile" ? "bg-[var(--accent-bg)]" : ""
          }`}
        >
          {profile.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.avatarUrl}
              alt=""
              className="w-9 h-9 rounded-full bg-[var(--hover)] object-cover flex-shrink-0"
              onError={(e) => (e.currentTarget.style.display = "none")}
            />
          ) : (
            <div className="w-9 h-9 rounded-full bg-[var(--accent-bg)] text-[var(--accent)] flex items-center justify-center font-semibold text-[13px] flex-shrink-0">
              {profile.name?.charAt(0) ?? "?"}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-[13px] truncate">{profile.name}</div>
            <div className="text-[var(--muted)] text-[12px] truncate">{profile.headline || profile.role || ""}</div>
          </div>
        </button>
      )}
      {weeks.length > 0 && (
        <div className="px-4 pt-3 pb-1.5 text-[11px] text-[var(--muted)] uppercase tracking-wider font-semibold flex items-center justify-between">
          <span>Weken</span>
          <span className="tabular-nums">{weeks.length}</span>
        </div>
      )}
      <div className="flex-1 overflow-y-auto">
        {weeks.map((w) => {
          const active = w.week.isoWeek === activeIso && view === "week";
          return (
            <button
              key={w.week.isoWeek}
              type="button"
              onClick={() => onSelectWeek(w.week.isoWeek)}
              className={`w-full text-left px-4 py-2.5 border-b border-[var(--border)] cursor-pointer border-l-[3px] select-none ${
                active
                  ? "bg-[var(--accent-bg)] border-l-[var(--accent)]"
                  : "border-l-transparent hover:bg-[var(--hover)]"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="font-semibold text-[13px] tabular-nums">{w.week.isoWeek}</div>
                <span className="tabular-nums font-medium text-[12px] text-[var(--muted)]">{fmtH(w.totals.seconds)}u</span>
              </div>
              <div className="text-[var(--muted)] text-[11.5px] mt-0.5 flex items-center justify-between gap-2">
                <span>
                  {fmtDate(w.week.from)} – {fmtDate(w.week.to)}
                </span>
                <StatusPill status={w.approval.status} />
              </div>
            </button>
          );
        })}
      </div>
    </aside>
  );
}

function ProfileDetail({ profile }: { profile: EverhourProfile }) {
  const groups = Array.isArray(profile.groups) ? profile.groups.map((g) => g.name).join(", ") : "";
  const tz = profile.timezone != null ? `UTC${profile.timezone >= 0 ? "+" : ""}${profile.timezone}` : "";
  const since = profile.createdAt ? profile.createdAt.slice(0, 10) : "";
  const avatar = profile.avatarUrlLarge || profile.avatarUrl;

  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-5 mb-7">
        {avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatar}
            alt=""
            className="w-20 h-20 rounded-full bg-[var(--hover)] object-cover border border-[var(--border)]"
          />
        ) : (
          <div className="w-20 h-20 rounded-full bg-[var(--accent-bg)] text-[var(--accent)] flex items-center justify-center font-semibold text-3xl border border-[var(--border)]">
            {profile.name?.charAt(0) ?? "?"}
          </div>
        )}
        <div>
          <h2 className="m-0 text-2xl font-semibold tracking-tight">{profile.name}</h2>
          <div className="text-[var(--muted)] text-[13px] mt-1">
            {profile.headline || profile.role}
            {profile.email ? ` · ${profile.email}` : ""}
          </div>
        </div>
      </div>

      <SectionTitle>Profiel</SectionTitle>
      <dl className="grid grid-cols-[180px_1fr] gap-y-2.5 gap-x-4 m-0 bg-[var(--panel)] border border-[var(--border)] rounded-xl p-5">
        <Field k="Rol" v={profile.role} />
        <Field k="Status" v={profile.status} />
        <Field k="Headline" v={profile.headline} />
        <Field k="Groepen" v={groups} />
        <Field k="Tijdzone" v={tz} />
        <Field k="Lid sinds" v={since} />
        <Field k="Capaciteit" v={`${profile.capacity ?? 0} u/week`} mono />
        <Field k="Kostprijs" v={String(profile.cost ?? 0)} mono />
        <Field k="User ID" v={String(profile.id)} mono />
        <Field k="Laatst gesynct" v={profile.exportedAt} mono />
      </dl>
    </div>
  );
}

function Field({ k, v, mono }: { k: string; v: string | null | undefined; mono?: boolean }) {
  return (
    <>
      <dt className="text-[var(--muted)] text-[13px]">{k}</dt>
      <dd className={`m-0 text-[13.5px] ${mono ? "font-mono text-[12.5px] tabular-nums" : ""}`}>{v || "—"}</dd>
    </>
  );
}

function SectionTitle({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)] mb-2.5 ${className}`}>
      {children}
    </div>
  );
}

function fullWeekDays(week: WeekRecord): WeekDay[] {
  const start = parseDate(week.week.from);
  const byDate = new Map(week.days.map((d) => [d.date, d]));
  const result: WeekDay[] = [];
  for (let i = 0; i < 7; i++) {
    const dt = new Date(start);
    dt.setDate(dt.getDate() + i);
    const iso = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
    const existing = byDate.get(iso);
    result.push(
      existing ?? {
        date: iso,
        weekday: dt.toLocaleDateString("en-US", { weekday: "long" }),
        totalSeconds: 0,
        entries: [],
      },
    );
  }
  return result;
}

function WeekDetail({ week }: { week: WeekRecord }) {
  const days = useMemo(() => fullWeekDays(week), [week]);
  const byTask = new Map<string, { task: { id: string; name: string; linearKey: string | null; url: string | null }; seconds: number }>();
  for (const day of days) {
    for (const e of day.entries) {
      const cur = byTask.get(e.task.id) || { task: e.task, seconds: 0 };
      cur.seconds += e.seconds;
      byTask.set(e.task.id, cur);
    }
  }
  const tasks = [...byTask.values()].sort((a, b) => b.seconds - a.seconds);
  const workingDays = days.filter((d) => d.totalSeconds > 0);
  const maxDay = Math.max(1, ...days.map((d) => d.totalSeconds));
  const avgPerDay = workingDays.length ? workingDays.reduce((a, d) => a + d.totalSeconds, 0) / workingDays.length / 3600 : 0;

  return (
    <div className="max-w-5xl">
      <div className="flex items-baseline gap-3 mb-1">
        <h2 className="m-0 text-[26px] font-semibold tracking-tight tabular-nums">{week.week.isoWeek}</h2>
        <StatusPill status={week.approval.status} />
      </div>
      <div className="text-[var(--muted)] text-[13px] mb-6">
        {fmtFullDate(week.week.from)} t/m {fmtFullDate(week.week.to)}
        {week.approval.submittedAt ? ` · ingediend ${week.approval.submittedAt.slice(0, 10)}` : ""}
      </div>

      <div className="grid grid-cols-3 gap-3 mb-7">
        <Card label="Totaal uren" value={`${fmtH(week.totals.seconds)}u`} hint={`${tasks.length} ${tasks.length === 1 ? "ticket" : "tickets"}`} />
        <Card label="Werkdagen" value={String(workingDays.length)} hint={workingDays.length ? `gem. ${avgPerDay.toFixed(2)}u/dag` : "geen werk geregistreerd"} />
        <Card label="Status" value={<StatusPill status={week.approval.status} />} hint={week.approval.submittedAt ? `ingediend ${week.approval.submittedAt.slice(0, 10)}` : "niet ingediend"} small />
      </div>

      <SectionTitle>Per dag</SectionTitle>
      <div className="bg-[var(--panel)] border border-[var(--border)] rounded-xl px-5 py-4 grid grid-cols-7 gap-3 mb-7">
        {days.map((d) => {
          const isEmpty = d.totalSeconds === 0;
          const pct = (d.totalSeconds / maxDay) * 100;
          return (
            <div key={d.date} className="flex flex-col items-center gap-1.5">
              <div className={`text-[12px] tabular-nums font-medium min-h-[18px] ${isEmpty ? "text-[var(--muted-soft)]" : ""}`}>
                {isEmpty ? "—" : `${fmtH(d.totalSeconds)}u`}
              </div>
              <div className="w-full h-[88px] flex items-end">
                <div
                  className={`w-full rounded-t min-h-[2px] ${isEmpty ? "bg-[var(--border)]" : "bg-[var(--accent)]"}`}
                  style={{ height: `${pct.toFixed(2)}%` }}
                />
              </div>
              <div className="text-[11px] text-[var(--muted)]">{cap(nlWeekday(d.date)).slice(0, 3)}</div>
              <div className="text-[10px] text-[var(--muted-soft)] tabular-nums">{fmtDate(d.date)}</div>
            </div>
          );
        })}
      </div>

      <SectionTitle>Per ticket</SectionTitle>
      <div className="bg-[var(--panel)] border border-[var(--border)] rounded-xl overflow-hidden mb-7">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-[#fafafa]">
              <th className="px-4 py-2.5 text-left border-b border-[var(--border)] text-[11px] uppercase tracking-wider text-[var(--muted)] font-medium w-[100px]">Ticket</th>
              <th className="px-4 py-2.5 text-left border-b border-[var(--border)] text-[11px] uppercase tracking-wider text-[var(--muted)] font-medium">Titel</th>
              <th className="px-4 py-2.5 text-right border-b border-[var(--border)] text-[11px] uppercase tracking-wider text-[var(--muted)] font-medium w-[90px]">Uren</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((t, idx) => (
              <tr key={t.task.id} className={`hover:bg-[#fafbfc] ${idx === tasks.length - 1 ? "" : "border-b border-[var(--border)]"}`}>
                <td className="px-4 py-2.5 text-[var(--muted)] tabular-nums whitespace-nowrap font-medium text-[12.5px]">
                  {t.task.url ? (
                    <a href={t.task.url} target="_blank" rel="noopener noreferrer" className="text-[var(--accent)] hover:underline">
                      {t.task.linearKey || ""}
                    </a>
                  ) : (
                    t.task.linearKey || ""
                  )}
                </td>
                <td className="px-4 py-2.5 text-[13.5px]">{t.task.name}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-[13px]">{fmtH(t.seconds)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <SectionTitle>Dagelijkse details</SectionTitle>
      <div className="flex flex-col gap-1.5 mb-4">
        {days.map((d) => {
          const clock = d.clockIn ? `${d.clockIn} – ${d.clockOut || "(open)"}` : "";
          return (
            <details key={d.date} className="bg-[var(--panel)] border border-[var(--border)] rounded-xl px-4 py-2.5 group">
              <summary className="cursor-pointer flex items-center gap-3 list-none">
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 10 10"
                  className="text-[var(--muted-soft)] transition-transform group-open:rotate-90 flex-shrink-0"
                  fill="currentColor"
                >
                  <path d="M3 1l4 4-4 4z" />
                </svg>
                <span className="font-semibold min-w-[100px] text-[13.5px]">{cap(nlWeekday(d.date))}</span>
                <span className="text-[var(--muted)] min-w-[110px] tabular-nums text-[12.5px]">{fmtFullDate(d.date)}</span>
                <span className="text-[var(--muted)] flex-1 text-[12px] tabular-nums">{clock}</span>
                <span className="tabular-nums font-medium text-[13px]">{fmtH(d.totalSeconds)}u</span>
              </summary>
              <div className="mt-2.5 pl-6 border-t border-[var(--border)] pt-2.5">
                {d.entries.length === 0 ? (
                  <div className="text-[var(--muted-soft)] italic text-[13px] py-1">Geen tijdregistraties</div>
                ) : (
                  d.entries.map((e, i) => (
                    <div key={i} className="flex gap-3 py-1 text-[13px] items-baseline">
                      <span className="text-[var(--muted)] w-20 flex-shrink-0 tabular-nums font-medium">
                        {e.task.url ? (
                          <a href={e.task.url} target="_blank" rel="noopener noreferrer" className="text-[var(--accent)] hover:underline">
                            {e.task.linearKey || ""}
                          </a>
                        ) : (
                          e.task.linearKey || ""
                        )}
                      </span>
                      <span className="flex-1">{e.task.name}</span>
                      <span className="w-16 text-right tabular-nums text-[var(--muted)]">{fmtH(e.seconds)}u</span>
                    </div>
                  ))
                )}
              </div>
            </details>
          );
        })}
      </div>
    </div>
  );
}

function Card({ label, value, hint, small }: { label: string; value: React.ReactNode; hint?: string; small?: boolean }) {
  return (
    <div className="bg-[var(--panel)] border border-[var(--border)] rounded-xl px-4 py-3.5">
      <div className="text-[var(--muted)] text-[11px] uppercase tracking-wider font-medium">{label}</div>
      <div className={`${small ? "text-[16px] mt-1.5" : "text-[24px] mt-1"} font-semibold tabular-nums leading-none`}>{value}</div>
      {hint && <div className="text-[var(--muted-soft)] text-[12px] mt-1.5">{hint}</div>}
    </div>
  );
}

function KeyDialog({
  hasEnvKey,
  onClose,
  onSaved,
}: {
  hasEnvKey: boolean;
  onClose: () => void;
  onSaved: (value: string) => void;
}) {
  const [val, setVal] = useState(() => (typeof window !== "undefined" ? localStorage.getItem(KEY_STORAGE) || "" : ""));

  function save() {
    const trimmed = val.trim();
    if (trimmed) localStorage.setItem(KEY_STORAGE, trimmed);
    else localStorage.removeItem(KEY_STORAGE);
    onSaved(trimmed);
  }

  function onKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") save();
    else if (e.key === "Escape") onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-[var(--panel)] border border-[var(--border)] rounded-xl max-w-md w-full p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="m-0 mb-2 text-[15px] font-semibold">Everhour API-sleutel</h3>
        <p className="m-0 mb-4 text-[var(--muted)] text-[13px] leading-relaxed">
          {hasEnvKey
            ? "De server heeft een dev-sleutel. Vul hieronder een eigen sleutel in om die te overschrijven — wordt alleen in deze browser bewaard (localStorage)."
            : "Plak je persoonlijke API-sleutel. Wordt alleen in deze browser bewaard (localStorage) en bij elke sync naar de server gestuurd."}
        </p>
        <input
          type="password"
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={onKey}
          placeholder="xxxx-xxxx-xxxx-xxxx"
          autoComplete="off"
          autoFocus
          className="w-full px-3 py-2 border border-[var(--border)] rounded-md text-[13px] font-mono mb-4 focus:outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-bg)]"
        />
        <div className="flex justify-end gap-2">
          <Button onClick={onClose}>Annuleer</Button>
          <Button primary onClick={save}>Opslaan</Button>
        </div>
        <p className="m-0 mt-4 text-[var(--muted-soft)] text-[11.5px]">
          Je kan een sleutel maken op{" "}
          <a
            href="https://app.everhour.com/#/account/profile"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--accent)] hover:underline"
          >
            Settings → Application Access
          </a>
          .
        </p>
      </div>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { EverhourProfile, SyncPayload, WeekRecord } from "@/lib/everhour";

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

function StatusPill({ status }: { status: string }) {
  return <span className={`status-pill ${status}`}>{statusLabel[status] ?? status}</span>;
}

type Toast = { id: number; msg: string; kind?: "good" | "error" };
type View = "empty" | "profile" | "week";

export default function Viewer() {
  const [profile, setProfile] = useState<EverhourProfile | null>(null);
  const [weeks, setWeeks] = useState<WeekRecord[]>([]);
  const [view, setView] = useState<View>("empty");
  const [activeIso, setActiveIso] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [keyDialogOpen, setKeyDialogOpen] = useState(false);
  const [hasEnvKey, setHasEnvKey] = useState<boolean | null>(null);
  const pickerRef = useRef<HTMLInputElement>(null);

  const toast = useCallback((msg: string, kind?: "good" | "error") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, msg, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === "error" ? 5000 : 2500);
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw) as SyncPayload;
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
    fetch("/api/sync").then((r) => r.json()).then((d: { hasEnvKey: boolean }) => setHasEnvKey(d.hasEnvKey)).catch(() => setHasEnvKey(false));
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

  async function runSync() {
    const overrideKey = localStorage.getItem(KEY_STORAGE)?.trim();
    if (!overrideKey && hasEnvKey === false) {
      setKeyDialogOpen(true);
      return;
    }
    setSyncing(true);
    setProgress("Verbinden met Everhour…");
    try {
      const resp = await fetch("/api/sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(overrideKey ? { "x-everhour-key": overrideKey } : {}),
        },
        body: JSON.stringify({ weeksBack: 78 }),
      });
      const json = (await resp.json()) as SyncPayload | { error: string };
      if (!resp.ok || "error" in json) {
        throw new Error("error" in json ? json.error : `HTTP ${resp.status}`);
      }
      setProfile(json.profile);
      setWeeks(json.weeks);
      persist(json.profile, json.weeks);
      if (json.weeks.length) {
        const sorted = [...json.weeks].sort((a, b) => b.week.from.localeCompare(a.week.from));
        setActiveIso(sorted[0].week.isoWeek);
        setView("week");
      } else {
        setView("profile");
      }
      toast(`Sync klaar: ${json.weeks.length} weken geladen.`, "good");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast("Sync mislukt: " + msg, "error");
    } finally {
      setSyncing(false);
      setProgress(null);
    }
  }

  function clearAll() {
    if (!confirm("Lokale gegevens wissen?")) return;
    localStorage.removeItem(STORAGE_KEY);
    setProfile(null);
    setWeeks([]);
    setActiveIso(null);
    setView("empty");
    toast("Cache gewist", "good");
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

  const totalHours = useMemo(() => weeks.reduce((acc, w) => acc + w.totals.seconds, 0) / 3600, [weeks]);
  const headerSub = profile
    ? `${profile.name} — ${weeks.length} ${weeks.length === 1 ? "week" : "weken"}, ${totalHours.toFixed(1)}u`
    : weeks.length
      ? `${weeks.length} weken, ${totalHours.toFixed(1)}u`
      : "Geen gegevens geladen";

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <header className="px-5 py-3 bg-[var(--panel)] border-b border-[var(--border)] flex items-center gap-4">
        <h1 className="m-0 text-base font-semibold">
          Everhour viewer <span className="text-[11px] text-[var(--muted-soft)] font-normal ml-1.5">NextJS</span>
        </h1>
        <span className="text-[var(--muted)] text-[13px]">{progress ?? headerSub}</span>
        <span className="flex-1" />
        <input
          ref={pickerRef}
          type="file"
          multiple
          accept=".json"
          className="hidden"
          onChange={(e) => e.target.files && loadFiles(e.target.files)}
        />
        <Button onClick={() => pickerRef.current?.click()}>Laden</Button>
        <Button onClick={() => setKeyDialogOpen(true)}>API-sleutel</Button>
        <Button primary disabled={syncing} onClick={runSync}>
          {syncing ? "Bezig…" : "Synchroniseer"}
        </Button>
        {(profile || weeks.length > 0) && <Button onClick={clearAll}>Wissen</Button>}
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
        <main className="flex-1 overflow-y-auto px-9 py-7">
          {view === "profile" && profile ? (
            <ProfileDetail profile={profile} />
          ) : view === "week" && activeWeek ? (
            <WeekDetail week={activeWeek} />
          ) : (
            <Empty onLoad={() => pickerRef.current?.click()} onSync={runSync} />
          )}
        </main>
      </div>

      <div className="fixed bottom-5 right-5 flex flex-col gap-2 z-50">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`px-4 py-2.5 rounded-lg text-[13px] text-white shadow-lg max-w-sm ${
              t.kind === "error" ? "bg-[var(--bad)]" : t.kind === "good" ? "bg-[var(--good)]" : "bg-[var(--foreground)]"
            }`}
          >
            {t.msg}
          </div>
        ))}
      </div>

      {keyDialogOpen && (
        <KeyDialog
          hasEnvKey={hasEnvKey}
          onClose={() => setKeyDialogOpen(false)}
          onSaved={() => {
            setKeyDialogOpen(false);
            toast("API-sleutel opgeslagen", "good");
          }}
        />
      )}
    </div>
  );
}

function Button({
  children,
  onClick,
  primary,
  disabled,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  primary?: boolean;
  disabled?: boolean;
}) {
  const base = "px-3.5 py-2 rounded-md text-[13px] font-medium border transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer";
  const styles = primary
    ? `${base} bg-[var(--accent)] text-white border-[var(--accent)] hover:brightness-110`
    : `${base} bg-[var(--panel)] border-[var(--border)] hover:bg-[var(--hover)]`;
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={styles}>
      {children}
    </button>
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
  return (
    <aside className="w-[280px] bg-[var(--panel)] border-r border-[var(--border)] overflow-y-auto flex-shrink-0 flex flex-col">
      {profile && (
        <div
          className={`px-4 py-3.5 border-b border-[var(--border)] flex items-center gap-3 cursor-pointer select-none hover:bg-[var(--hover)] ${
            view === "profile" ? "bg-[var(--accent-bg)]" : ""
          }`}
          onClick={onSelectProfile}
        >
          {profile.avatarUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.avatarUrl}
              alt=""
              className="w-9 h-9 rounded-full bg-[var(--hover)] object-cover flex-shrink-0"
              onError={(e) => (e.currentTarget.style.display = "none")}
            />
          )}
          <div>
            <div className="font-semibold text-[13px]">{profile.name}</div>
            <div className="text-[var(--muted)] text-[12px]">{profile.headline || profile.role || ""}</div>
          </div>
        </div>
      )}
      {weeks.length > 0 && (
        <div className="px-4 pt-2.5 pb-1 text-[11px] text-[var(--muted)] uppercase tracking-wider font-semibold">
          {weeks.length} {weeks.length === 1 ? "week" : "weken"}
        </div>
      )}
      <div className="flex-1 overflow-y-auto">
        {weeks.map((w) => {
          const active = w.week.isoWeek === activeIso && view === "week";
          return (
            <div
              key={w.week.isoWeek}
              onClick={() => onSelectWeek(w.week.isoWeek)}
              className={`px-4 py-2.5 border-b border-[var(--border)] cursor-pointer border-l-[3px] select-none ${
                active ? "bg-[var(--accent-bg)] border-l-[var(--accent)]" : "border-l-transparent hover:bg-[var(--hover)]"
              }`}
            >
              <div className="font-semibold text-[13px] tabular-nums">{w.week.isoWeek}</div>
              <div className="text-[var(--muted)] text-[12px] mt-0.5">
                {fmtDate(w.week.from)} - {fmtDate(w.week.to)}
              </div>
              <div className="flex items-center justify-between mt-1.5 gap-2">
                <span className="tabular-nums font-medium text-[13px]">{fmtH(w.totals.seconds)}u</span>
                <StatusPill status={w.approval.status} />
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}

function Empty({ onLoad, onSync }: { onLoad: () => void; onSync: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center text-[var(--muted)] gap-1.5">
      <h2 className="m-0 mb-2 text-[var(--foreground)] font-semibold">Geen gegevens geladen</h2>
      <p className="m-0">Klik <strong>Synchroniseer</strong> om uit Everhour op te halen,</p>
      <p className="m-0">of <strong>Laden</strong> om lokale JSON-bestanden te kiezen.</p>
      <div className="mt-4 flex gap-2">
        <Button onClick={onLoad}>Laden</Button>
        <Button primary onClick={onSync}>Synchroniseer</Button>
      </div>
    </div>
  );
}

function ProfileDetail({ profile }: { profile: EverhourProfile }) {
  const groups = Array.isArray(profile.groups) ? profile.groups.map((g) => g.name).join(", ") : "";
  const tz = profile.timezone != null ? `UTC${profile.timezone >= 0 ? "+" : ""}${profile.timezone}` : "";
  const since = profile.createdAt ? profile.createdAt.slice(0, 10) : "";
  const avatar = profile.avatarUrlLarge || profile.avatarUrl;

  return (
    <div>
      <div className="flex items-center gap-4 mb-5">
        {avatar && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatar}
            alt=""
            className="w-[88px] h-[88px] rounded-full bg-[var(--hover)] object-cover border border-[var(--border)]"
          />
        )}
        <div>
          <h2 className="m-0 text-2xl font-semibold">{profile.name}</h2>
          <div className="text-[var(--muted)] text-[13px] mt-1">
            {profile.headline || profile.role}
            {profile.email ? ` · ${profile.email}` : ""}
          </div>
        </div>
      </div>

      <SectionTitle>Profiel</SectionTitle>
      <dl className="grid grid-cols-[180px_1fr] gap-y-2.5 gap-x-4 m-0">
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
      <dd className={`m-0 text-sm ${mono ? "font-mono text-[13px] tabular-nums" : ""}`}>{v || "—"}</dd>
    </>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)] mt-7 mb-2.5">
      {children}
    </div>
  );
}

function WeekDetail({ week }: { week: WeekRecord }) {
  const byTask = new Map<string, { task: { id: string; name: string; linearKey: string | null; url: string | null }; seconds: number }>();
  for (const day of week.days) {
    for (const e of day.entries) {
      const cur = byTask.get(e.task.id) || { task: e.task, seconds: 0 };
      cur.seconds += e.seconds;
      byTask.set(e.task.id, cur);
    }
  }
  const tasks = [...byTask.values()].sort((a, b) => b.seconds - a.seconds);
  const workingDays = week.days.filter((d) => d.totalSeconds > 0);
  const maxDay = Math.max(1, ...week.days.map((d) => d.totalSeconds));
  const avgPerDay = workingDays.length ? workingDays.reduce((a, d) => a + d.totalSeconds, 0) / workingDays.length / 3600 : 0;

  return (
    <div>
      <h2 className="m-0 mb-1 text-2xl font-semibold flex items-center gap-2.5">
        {week.week.isoWeek} <StatusPill status={week.approval.status} />
      </h2>
      <div className="text-[var(--muted)] text-[13px] mb-5">
        {fmtFullDate(week.week.from)} t/m {fmtFullDate(week.week.to)}
        {week.approval.submittedAt ? ` · ingediend ${week.approval.submittedAt}` : ""}
        {week.user?.name ? ` · ${week.user.name}` : ""}
      </div>

      <div className="grid grid-cols-3 gap-3 mb-6">
        <Card label="Totaal uren" value={`${fmtH(week.totals.seconds)}u`} hint={`${tasks.length} ${tasks.length === 1 ? "ticket" : "tickets"}`} />
        <Card label="Werkdagen" value={String(workingDays.length)} hint={workingDays.length ? `gem. ${avgPerDay.toFixed(2)}u/dag` : ""} />
        <Card label="Status" value={<StatusPill status={week.approval.status} />} hint={week.approval.submittedAt ? `ingediend ${week.approval.submittedAt.slice(0, 10)}` : "niet ingediend"} small />
      </div>

      <SectionTitle>Dagelijks overzicht</SectionTitle>
      <div className="bg-[var(--panel)] border border-[var(--border)] rounded-xl px-5 py-4 grid grid-cols-7 gap-3">
        {week.days.map((d) => {
          const isEmpty = d.totalSeconds === 0;
          const pct = (d.totalSeconds / maxDay) * 100;
          return (
            <div key={d.date} className="flex flex-col items-center gap-1.5">
              <div className={`text-[12px] tabular-nums font-medium min-h-[18px] ${isEmpty ? "text-[var(--muted-soft)]" : ""}`}>
                {isEmpty ? "—" : `${fmtH(d.totalSeconds)}u`}
              </div>
              <div className="w-full h-[100px] flex items-end">
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
      <table className="w-full bg-[var(--panel)] border border-[var(--border)] rounded-xl overflow-hidden border-collapse">
        <thead>
          <tr>
            <th className="px-3.5 py-2.5 text-left border-b border-[var(--border)] bg-[#fafafa] text-[11px] uppercase tracking-wider text-[var(--muted)] font-medium w-[90px]">Ticket</th>
            <th className="px-3.5 py-2.5 text-left border-b border-[var(--border)] bg-[#fafafa] text-[11px] uppercase tracking-wider text-[var(--muted)] font-medium">Titel</th>
            <th className="px-3.5 py-2.5 text-right border-b border-[var(--border)] bg-[#fafafa] text-[11px] uppercase tracking-wider text-[var(--muted)] font-medium w-[100px]">Uren</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((t) => (
            <tr key={t.task.id} className="hover:bg-[#fafbfc]">
              <td className="px-3.5 py-2.5 border-b border-[var(--border)] text-[var(--muted)] tabular-nums whitespace-nowrap font-medium">
                {t.task.url ? (
                  <a href={t.task.url} target="_blank" rel="noopener noreferrer" className="text-[var(--accent)] hover:underline">
                    {t.task.linearKey || ""}
                  </a>
                ) : (
                  t.task.linearKey || ""
                )}
              </td>
              <td className="px-3.5 py-2.5 border-b border-[var(--border)]">{t.task.name}</td>
              <td className="px-3.5 py-2.5 border-b border-[var(--border)] text-right tabular-nums">{fmtH(t.seconds)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <SectionTitle>Per dag</SectionTitle>
      <div className="flex flex-col gap-2">
        {week.days.map((d) => {
          const clock = d.clockIn ? `${d.clockIn} - ${d.clockOut || "(nog open)"}` : "";
          return (
            <details key={d.date} className="bg-[var(--panel)] border border-[var(--border)] rounded-xl px-4 py-3">
              <summary className="cursor-pointer flex items-center gap-3 list-none">
                <span className="font-semibold min-w-[100px]">{cap(nlWeekday(d.date))}</span>
                <span className="text-[var(--muted)] min-w-[110px] tabular-nums">{fmtFullDate(d.date)}</span>
                <span className="text-[var(--muted)] flex-1 text-[12px] tabular-nums">{clock}</span>
                <span className="tabular-nums font-medium">{fmtH(d.totalSeconds)}u</span>
              </summary>
              <div className="mt-3 pl-6 border-t border-[var(--border)] pt-2.5">
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
    <div className="bg-[var(--panel)] border border-[var(--border)] rounded-xl px-4 py-4">
      <div className="text-[var(--muted)] text-[11px] uppercase tracking-wider font-medium">{label}</div>
      <div className={`${small ? "text-[17px]" : "text-2xl"} font-semibold mt-1 tabular-nums`}>{value}</div>
      {hint && <div className="text-[var(--muted-soft)] text-[12px] mt-0.5">{hint}</div>}
    </div>
  );
}

function KeyDialog({ hasEnvKey, onClose, onSaved }: { hasEnvKey: boolean | null; onClose: () => void; onSaved: () => void }) {
  const [val, setVal] = useState(() => (typeof window !== "undefined" ? localStorage.getItem(KEY_STORAGE) || "" : ""));

  function save() {
    if (val.trim()) localStorage.setItem(KEY_STORAGE, val.trim());
    else localStorage.removeItem(KEY_STORAGE);
    onSaved();
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-[var(--panel)] border border-[var(--border)] rounded-xl max-w-md w-[90%] p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="m-0 mb-2 text-base font-semibold">Everhour API-sleutel</h3>
        <p className="m-0 mb-3.5 text-[var(--muted)] text-[13px]">
          {hasEnvKey
            ? "Een sleutel uit .env.local is beschikbaar. Vul hieronder in om die te overschrijven (alleen in deze browser)."
            : "Geen sleutel in .env.local gevonden. Plak een persoonlijke API-sleutel — wordt lokaal opgeslagen (localStorage)."}
        </p>
        <input
          type="password"
          value={val}
          onChange={(e) => setVal(e.target.value)}
          placeholder="xxxx-xxxx-xxxx-xxxx"
          autoComplete="off"
          className="w-full px-2.5 py-2 border border-[var(--border)] rounded-md text-[13px] font-mono mb-3.5"
        />
        <div className="flex justify-end gap-2">
          <Button onClick={onClose}>Annuleer</Button>
          <Button primary onClick={save}>Opslaan</Button>
        </div>
      </div>
    </div>
  );
}

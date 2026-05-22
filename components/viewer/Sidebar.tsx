"use client";

import type { EverhourProfile, WeekRecord } from "@/lib/everhour";
import { StatusPill } from "@/components/ui";
import { fmtDateShort, fmtHours } from "@/lib/format";

export type SidebarView = "empty" | "profile" | "week";

export interface SidebarProps {
  readonly profile: EverhourProfile | null;
  readonly weeks: ReadonlyArray<WeekRecord>;
  readonly activeIso: string | null;
  readonly view: SidebarView;
  readonly onSelectWeek: (iso: string) => void;
  readonly onSelectProfile: () => void;
}

export function Sidebar({
  profile,
  weeks,
  activeIso,
  view,
  onSelectWeek,
  onSelectProfile,
}: SidebarProps) {
  if (!profile && weeks.length === 0) return null;

  return (
    <aside
      aria-label="Navigatie"
      className="w-[300px] bg-[var(--panel)] border-r border-[var(--border)] overflow-hidden flex-shrink-0 flex flex-col"
    >
      {profile ? (
        <ProfileCard profile={profile} active={view === "profile"} onClick={onSelectProfile} />
      ) : null}

      {weeks.length > 0 ? (
        <div className="px-4 pt-3 pb-1.5 text-[11px] text-[var(--muted)] uppercase tracking-wider font-semibold flex items-center justify-between">
          <span>Weken</span>
          <span className="tabular-nums">{weeks.length}</span>
        </div>
      ) : null}

      <div className="flex-1 overflow-y-auto">
        {weeks.map((w) => (
          <WeekRow
            key={w.week.isoWeek}
            week={w}
            active={w.week.isoWeek === activeIso && view === "week"}
            onClick={() => onSelectWeek(w.week.isoWeek)}
          />
        ))}
      </div>
    </aside>
  );
}

function ProfileCard({
  profile,
  active,
  onClick,
}: {
  profile: EverhourProfile;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-3 border-b border-[var(--border)] flex items-center gap-3 cursor-pointer select-none hover:bg-[var(--hover)] text-left ${
        active ? "bg-[var(--accent-bg)]" : ""
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
        <div className="text-[var(--muted)] text-[12px] truncate">
          {profile.headline || profile.role || ""}
        </div>
      </div>
    </button>
  );
}

function WeekRow({
  week,
  active,
  onClick,
}: {
  week: WeekRecord;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left px-4 py-2.5 border-b border-[var(--border)] cursor-pointer border-l-[3px] select-none ${
        active
          ? "bg-[var(--accent-bg)] border-l-[var(--accent)]"
          : "border-l-transparent hover:bg-[var(--hover)]"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="font-semibold text-[13px] tabular-nums">{week.week.isoWeek}</div>
        <span className="tabular-nums font-medium text-[12px] text-[var(--muted)]">
          {fmtHours(week.totals.seconds)}u
        </span>
      </div>
      <div className="text-[var(--muted)] text-[11.5px] mt-0.5 flex items-center justify-between gap-2">
        <span>
          {fmtDateShort(week.week.from)} – {fmtDateShort(week.week.to)}
        </span>
        <StatusPill status={week.approval.status} />
      </div>
    </button>
  );
}

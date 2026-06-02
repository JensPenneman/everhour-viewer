import {
  fmtDateShort,
  fmtDuration,
  fmtLocalTime,
  fmtSignedMinutes,
  localIsoDate,
} from "@/lib/format";
import type { ChangeRow as ChangeRowData } from "./day-audit";
import { CorrectionPill } from "./CorrectionPill";

export interface ChangeRowProps {
  readonly row: ChangeRowData;
  /** ISO date of the day being viewed — used to flag edits that landed later. */
  readonly dayDate: string;
  readonly tzOffsetHours: number | null;
}

type Tone = "bad" | "warn" | "self";

/**
 * One entry in the "Wat is gewijzigd" feed.
 *
 * A foreign reduction is the loudest signal (red, left bar); a foreign
 * addition or comment is amber; the owner's own edits are quiet (no bar,
 * muted) so "I fixed my own timer" never looks like a boss intervention.
 */
export function ChangeRow({ row, dayDate, tzOffsetHours }: ChangeRowProps) {
  const { edit, isForeign } = row;
  const isComment = edit.action === "COMMENT";
  const negative = edit.deltaSeconds < 0;

  const tone: Tone = !isForeign ? "self" : edit.action === "EDIT" && negative ? "bad" : "warn";
  const container =
    tone === "bad"
      ? "border-l-bad bg-bad-bg"
      : tone === "warn"
        ? "border-l-warn bg-warn-bg"
        : "border-l-transparent bg-panel";
  const deltaColor = tone === "bad" ? "text-bad" : tone === "warn" ? "text-warn" : "text-muted";

  const verb = isComment ? "voegde een opmerking toe" : isForeign ? "corrigeerde" : "wijzigde";
  const pillLabel = isComment ? "Opmerking" : isForeign ? "Correctie" : "Eigen wijziging";

  // Compare on the LOCAL date (not the raw UTC slice) so a near-midnight
  // edit isn't mislabelled with the wrong day or have its date prefix hidden.
  const editDate = localIsoDate(edit.at, tzOffsetHours) ?? edit.at.slice(0, 10);
  const time = fmtLocalTime(edit.at, tzOffsetHours);
  const when = editDate && editDate !== dayDate ? `${fmtDateShort(editDate)} ${time}` : time;

  const linearKey = row.entry.task.linearKey;

  // Everhour stamps `previousTask`/`previousDate` on every edit, usually
  // echoing the entry's own task/date. Only call it a *move* when they
  // genuinely differ — otherwise it's just a duration correction in place.
  const movedFromTask = edit.fromTaskId != null && edit.fromTaskId !== row.entry.task.id;
  const movedFromDate = edit.fromDate != null && edit.fromDate !== dayDate;

  return (
    <div className={`border border-border border-l-4 rounded-xl px-3.5 py-2.5 ${container}`}>
      <div className="flex items-baseline gap-3">
        <div className="flex-1 min-w-0 text-[13px]">
          <span className={isForeign ? "font-semibold text-foreground" : "text-muted"}>
            {row.actorLabel}
          </span>{" "}
          <span className="text-muted">{verb}</span>{" "}
          <TaskRef url={row.entry.task.url} linearKey={linearKey} name={row.entry.task.name} />
        </div>
        <div className={`tabular-nums font-semibold text-[13px] shrink-0 ${deltaColor}`}>
          {isComment ? "—" : fmtSignedMinutes(edit.deltaSeconds)}
        </div>
      </div>

      <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12px] text-muted">
        {!isComment ? (
          <span className="tabular-nums">
            van {fmtDuration(edit.previousSeconds)} → {fmtDuration(row.newSeconds)}
          </span>
        ) : null}
        {when ? <span className="tabular-nums">{when}</span> : null}
        {row.comment ? <span className="text-foreground">💬 “{row.comment}”</span> : null}
        {movedFromTask ? (
          <span className="text-muted-soft">↳ verplaatst van een ander ticket</span>
        ) : null}
        {movedFromDate ? (
          <span className="text-muted-soft">↳ verplaatst van {fmtDateShort(edit.fromDate!)}</span>
        ) : null}
        {tone === "self" ? (
          <span className="inline-flex items-center rounded-full bg-hover px-2 py-0.5 text-[11px] font-medium text-muted">
            {pillLabel}
          </span>
        ) : (
          <CorrectionPill tone={tone}>{pillLabel}</CorrectionPill>
        )}
      </div>
    </div>
  );
}

function TaskRef({
  url,
  linearKey,
  name,
}: {
  url: string | null;
  linearKey: string | null;
  name: string;
}) {
  const label = linearKey || name;
  if (url) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-accent hover:underline font-medium tabular-nums"
      >
        {label}
      </a>
    );
  }
  return <span className="text-foreground font-medium">{label}</span>;
}

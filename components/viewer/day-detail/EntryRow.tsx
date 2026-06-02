"use client";

import { useState } from "react";
import type { WeekEntry } from "@/lib/everhour";
import { fmtDuration, fmtSignedDuration } from "@/lib/format";
import { CorrectionPill } from "./CorrectionPill";
import {
  entryNetEditSeconds,
  entryWasCorrectedByOther,
  foreignNetEditSeconds,
  isForeignActor,
  resolveActorLabel,
} from "./day-audit";
import { HistoryLedger } from "./HistoryLedger";

export interface EntryRowProps {
  readonly entry: WeekEntry;
  readonly ownerId: number;
  readonly tzOffsetHours: number | null;
}

/**
 * One row of the "Per ticket" table, expandable to its full
 * {@link HistoryLedger}. A foreign correction marks the row with a red
 * inset bar and a `⚠ {actor}` badge in the DOOR column.
 */
export function EntryRow({ entry, ownerId, tzOffsetHours }: EntryRowProps) {
  const [open, setOpen] = useState(false);

  const history = entry.history ?? [];
  const expandable = history.length > 0;
  const netEdit = entryNetEditSeconds(entry);
  const correctedByOther = entryWasCorrectedByOther(entry, ownerId);
  // Tone keys off the FOREIGN net, never the owner's own edits: red only for
  // a foreign reduction, amber for a foreign addition / comment-only touch.
  const foreignNet = foreignNetEditSeconds(entry, ownerId);
  const foreignTone: "bad" | "warn" = foreignNet < 0 ? "bad" : "warn";

  const foreignActor = history.find(
    (h) => (h.action === "EDIT" || h.action === "COMMENT") && isForeignActor(h.by, ownerId),
  );
  const ownerEdited = history.some((h) => h.action === "EDIT" && !isForeignActor(h.by, ownerId));

  const wijzColor = correctedByOther
    ? foreignTone === "bad"
      ? "text-bad"
      : "text-warn"
    : ownerEdited
      ? "text-accent"
      : "text-muted";

  const toggle = () => expandable && setOpen((o) => !o);

  return (
    <>
      <tr
        className={`${expandable ? "cursor-pointer" : ""} hover:bg-[#fafbfc] border-b border-border`}
        onClick={toggle}
        style={correctedByOther ? { boxShadow: `inset 3px 0 0 var(--${foreignTone})` } : undefined}
      >
        <td className="px-4 py-2.5 text-muted tabular-nums whitespace-nowrap font-medium text-[12.5px]">
          <span className="inline-flex items-center gap-1.5">
            {expandable ? (
              <svg
                width="9"
                height="9"
                viewBox="0 0 10 10"
                className={`text-muted-soft transition-transform ${open ? "rotate-90" : ""}`}
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M3 1l4 4-4 4z" />
              </svg>
            ) : (
              <span className="w-[9px]" aria-hidden="true" />
            )}
            {entry.task.url ? (
              <a
                href={entry.task.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                {entry.task.linearKey || ""}
              </a>
            ) : (
              entry.task.linearKey || ""
            )}
          </span>
        </td>
        <td className="px-4 py-2.5 text-[13.5px]">{entry.task.name}</td>
        <td className="px-4 py-2.5 text-right tabular-nums text-[13px]">
          {fmtDuration(entry.seconds)}
        </td>
        <td className={`px-4 py-2.5 text-right tabular-nums text-[13px] font-medium ${wijzColor}`}>
          {netEdit === 0 ? "—" : fmtSignedDuration(netEdit)}
        </td>
        <td className="px-4 py-2.5 text-[12.5px] whitespace-nowrap">
          {correctedByOther && foreignActor ? (
            <CorrectionPill
              tone={foreignTone}
              title={`Gewijzigd door ${resolveActorLabel(foreignActor.byName, foreignActor.by)}`}
            >
              ⚠ {shortName(foreignActor.byName, foreignActor.by)}
            </CorrectionPill>
          ) : ownerEdited ? (
            <span className="text-muted">Jij</span>
          ) : (
            <span className="text-muted-soft">—</span>
          )}
        </td>
      </tr>
      {open ? (
        <tr>
          <td colSpan={5} className="px-4 pb-3 pt-0 bg-[#fafbfc]">
            <HistoryLedger entry={entry} ownerId={ownerId} tzOffsetHours={tzOffsetHours} />
          </td>
        </tr>
      ) : null}
    </>
  );
}

/** "Thomas Blommaert" → "Thomas B."; falls back to "#id" then a generic label. */
function shortName(full: string | null, by: number | null): string {
  if (!full) return by != null ? `#${by}` : "iemand anders";
  const parts = full.trim().split(/\s+/);
  if (parts.length < 2) return full;
  return `${parts[0]} ${parts[parts.length - 1]![0]!.toUpperCase()}.`;
}

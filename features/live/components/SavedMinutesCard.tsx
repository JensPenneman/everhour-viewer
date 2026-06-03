"use client";

import { useState } from "react";
import { Button, Menu, MenuItem, Panel, SectionTitle } from "@/shared/ui";
import { fmtDuration, fmtSignedDuration } from "@/lib/format";
import type { LedgerEntry, TaskMeta } from "@/lib/storage";

export interface CarryoverInfo {
  readonly date: string;
  readonly netMinutes: number;
}

export interface SavedMinutesCardProps {
  readonly entries: ReadonlyArray<LedgerEntry>;
  readonly netMinutes: number;
  /** Bank a signed correction (+ lost time / − over-logged). */
  readonly onAdd: (minutes: number, note?: string) => void;
  readonly onRemove: (id: string) => void;
  readonly target: TaskMeta | null;
  readonly candidates: ReadonlyArray<TaskMeta>;
  readonly onSelectTarget: (t: TaskMeta) => void;
  readonly canApply: boolean;
  /** Why apply is unavailable (shown as a hint); null when it is available. */
  readonly applyHint: string | null;
  readonly onApply: () => void;
  readonly carryover: CarryoverInfo | null;
  readonly onMoveCarryover: () => void;
}

const QUICK_MIN = [5, 15, 30] as const;

/**
 * The "Gespaarde minuten" ledger: bank time you forgot to track (+) or
 * over-logged (−), then apply the positive net to a ticket — the app runs a
 * real timer on it for that long (the only permitted way to log time here).
 */
export function SavedMinutesCard({
  entries,
  netMinutes,
  onAdd,
  onRemove,
  target,
  candidates,
  onSelectTarget,
  canApply,
  applyHint,
  onApply,
  carryover,
  onMoveCarryover,
}: SavedMinutesCardProps) {
  const [amount, setAmount] = useState<number>(15);
  const [note, setNote] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);

  const bank = (sign: 1 | -1) => {
    if (amount < 1) return;
    onAdd(sign * amount, note.trim());
    setNote("");
  };

  const netSec = netMinutes * 60;
  const netColor = netMinutes > 0 ? "text-good" : netMinutes < 0 ? "text-bad" : "text-muted";

  return (
    <section className="mb-5">
      <SectionTitle>Gespaarde minuten</SectionTitle>

      {carryover ? (
        <div className="mt-2 flex items-center justify-between gap-3 rounded-xl border border-warn-bg bg-warn-bg px-3.5 py-2 text-[12.5px] text-warn">
          <span>
            Openstaand saldo van {carryover.date}:{" "}
            <span className="font-semibold tabular-nums">
              {fmtSignedDuration(carryover.netMinutes * 60)}
            </span>
          </span>
          <button
            type="button"
            onClick={onMoveCarryover}
            className="shrink-0 underline hover:no-underline cursor-pointer"
          >
            Verplaats naar vandaag
          </button>
        </div>
      ) : null}

      <Panel className="mt-2 px-4 py-4">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-[12px] uppercase tracking-wider text-muted font-medium">Saldo</span>
          <span className={`text-[22px] font-semibold tabular-nums leading-none ${netColor}`}>
            {fmtSignedDuration(netSec)}
          </span>
        </div>

        {/* Bank a correction */}
        <div className="mt-3.5 flex flex-wrap items-center gap-2">
          <input
            type="number"
            min={1}
            max={600}
            value={amount}
            onChange={(e) =>
              setAmount(Math.max(1, Math.min(600, Math.floor(Number(e.target.value) || 0))))
            }
            aria-label="Aantal minuten"
            className="w-16 bg-panel border border-border rounded-md px-2 py-1.5 text-[13px] tabular-nums outline-none focus:border-accent"
          />
          <span className="text-[12.5px] text-muted">min</span>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Notitie (optioneel)"
            aria-label="Notitie"
            className="flex-1 min-w-[120px] bg-panel border border-border rounded-md px-2.5 py-1.5 text-[13px] outline-none focus:border-accent"
          />
          <Button
            variant="default"
            size="sm"
            onClick={() => bank(1)}
            title="Tijd die je werkte maar vergat te tracken"
          >
            + Bijboeken
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={() => bank(-1)}
            title="Tijd die je teveel geboekt hebt"
          >
            − Afboeken
          </Button>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {QUICK_MIN.map((m) => (
            <button
              key={`p${m}`}
              type="button"
              onClick={() => onAdd(m, "")}
              className="rounded-full border border-border bg-panel px-2.5 py-1 text-[12px] hover:bg-hover cursor-pointer text-good"
            >
              +{m}
            </button>
          ))}
          {QUICK_MIN.map((m) => (
            <button
              key={`m${m}`}
              type="button"
              onClick={() => onAdd(-m, "")}
              className="rounded-full border border-border bg-panel px-2.5 py-1 text-[12px] hover:bg-hover cursor-pointer text-bad"
            >
              −{m}
            </button>
          ))}
        </div>

        {/* Entries */}
        {entries.length > 0 ? (
          <ul className="mt-3.5 divide-y divide-border border-t border-border">
            {entries.map((e) => (
              <li key={e.id} className="flex items-center gap-3 py-2 text-[13px]">
                <span
                  className={`w-[64px] shrink-0 tabular-nums font-medium ${
                    e.minutes < 0 ? "text-bad" : "text-good"
                  }`}
                >
                  {fmtSignedDuration(e.minutes * 60)}
                </span>
                <span className="flex-1 min-w-0 truncate text-muted">
                  {e.note || (e.auto ? "automatische correctie" : "—")}
                  {e.auto ? (
                    <span className="ml-1.5 text-[10px] uppercase tracking-wide text-muted-soft">
                      auto
                    </span>
                  ) : null}
                </span>
                <button
                  type="button"
                  onClick={() => onRemove(e.id)}
                  aria-label="Verwijder"
                  className="shrink-0 text-muted-soft hover:text-bad cursor-pointer px-1"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-[12.5px] text-muted-soft">
            Nog niets gespaard. Boek minuten bij die je vergat te tracken, of af als je teveel
            boekte.
          </p>
        )}

        {/* Apply */}
        <div className="mt-4 border-t border-border pt-3.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[12.5px] text-muted">Pas toe op</span>
            <Menu
              open={pickerOpen}
              onClose={() => setPickerOpen(false)}
              anchor={
                <button
                  type="button"
                  onClick={() => setPickerOpen((o) => !o)}
                  disabled={candidates.length === 0}
                  className="inline-flex items-center gap-1.5 max-w-[260px] rounded-md border border-border bg-panel px-2.5 py-1.5 text-[12.5px] hover:bg-hover disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {target ? (
                    <>
                      {target.linearKey ? (
                        <span className="tabular-nums font-medium text-muted">
                          {target.linearKey}
                        </span>
                      ) : null}
                      <span className="truncate">{target.name}</span>
                    </>
                  ) : (
                    <span className="text-muted-soft">Kies een ticket</span>
                  )}
                  <span aria-hidden="true" className="text-muted-soft">
                    ▾
                  </span>
                </button>
              }
            >
              {candidates.map((c) => (
                <MenuItem
                  key={c.id}
                  onClick={() => {
                    onSelectTarget(c);
                    setPickerOpen(false);
                  }}
                >
                  {c.linearKey ? (
                    <span className="tabular-nums font-medium text-muted mr-1.5">
                      {c.linearKey}
                    </span>
                  ) : null}
                  {c.name}
                </MenuItem>
              ))}
            </Menu>
            <Button variant="primary" size="sm" disabled={!canApply} onClick={onApply}>
              {netMinutes > 0 ? `Pas toe (${fmtDuration(netSec)})` : "Pas toe"}
            </Button>
          </div>
          {applyHint ? <p className="mt-2 text-[12px] text-muted-soft">{applyHint}</p> : null}
        </div>
      </Panel>
    </section>
  );
}

import { SectionTitle } from "@/components/ui";
import { fmtDuration } from "@/lib/format";
import type { DayTimeline } from "./day-audit";
import { InferredHint } from "./InferredHint";

const TIMELINE_CAVEAT =
  "Tijdstippen zijn opslagmomenten van de timer, geen exacte start/stop. De tijdlijn is bij benadering.";

export interface TimeBarProps {
  readonly timeline: DayTimeline;
  /** Day still open (no clock-out) — the right edge is left unbounded. */
  readonly dayOpen?: boolean;
}

/**
 * Horizontal, deliberately-approximate decomposition of the day: accent
 * segments are tracked time, the bare track between them is a candidate
 * break. Always captioned as inferred — never presented as a precise log.
 */
export function TimeBar({ timeline, dayOpen }: TimeBarProps) {
  const span = timeline.domainEndMin - timeline.domainStartMin;
  if (span <= 0) return null;

  const pct = (min: number) => ((min - timeline.domainStartMin) / span) * 100;

  return (
    <section className="mb-7">
      <SectionTitle className="flex items-center">
        <span>Tijdlijn (bij benadering)</span>
        <InferredHint text={TIMELINE_CAVEAT} />
      </SectionTitle>

      <div className="bg-panel border border-border rounded-xl px-4 py-3.5">
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-muted tabular-nums shrink-0">
            {fmtMin(timeline.domainStartMin)}
          </span>
          <div className="relative h-2.5 flex-1 rounded-full bg-border overflow-hidden">
            {timeline.segments.map((s, i) => (
              <div
                key={`seg-${i}`}
                className="absolute inset-y-0 bg-accent"
                style={{
                  left: `${pct(s.startMin)}%`,
                  width: `${pct(s.endMin) - pct(s.startMin)}%`,
                }}
                title={`Geregistreerd · ${fmtMin(s.startMin)}–${fmtMin(s.endMin)} (bij benadering)`}
              />
            ))}
            {timeline.gaps.map((g, i) => (
              <div
                key={`gap-${i}`}
                className="absolute inset-y-0"
                style={{
                  left: `${pct(g.startMin)}%`,
                  width: `${pct(g.endMin) - pct(g.startMin)}%`,
                  backgroundImage:
                    "repeating-linear-gradient(45deg, var(--muted-soft) 0 1px, transparent 1px 4px)",
                  opacity: 0.5,
                }}
                title={`Gat ≈ ${fmtDuration((g.endMin - g.startMin) * 60)} (mogelijk pauze)`}
              />
            ))}
          </div>
          <span className="text-[11px] text-muted tabular-nums shrink-0">
            {dayOpen ? "(open)" : fmtMin(timeline.domainEndMin)}
          </span>
        </div>

        <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-soft">
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2 w-3 rounded-sm bg-accent" /> geregistreerd
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span
              className="inline-block h-2 w-3 rounded-sm"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(45deg, var(--muted-soft) 0 1px, transparent 1px 4px)",
              }}
            />{" "}
            gat (mogelijk pauze)
          </span>
          <span>{TIMELINE_CAVEAT}</span>
          {!timeline.tzKnown ? (
            <span className="text-warn">tijden in UTC (geen tijdzone bekend)</span>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function fmtMin(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

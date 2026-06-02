import type { ReactNode } from "react";

export type CorrectionTone = "bad" | "warn";

export interface CorrectionPillProps {
  readonly children: ReactNode;
  /** `bad` (red) for a foreign change; `warn` (amber) for added-on-your-behalf. */
  readonly tone?: CorrectionTone;
  readonly title?: string;
}

const TONE_CLASS: Record<CorrectionTone, string> = {
  bad: "bg-bad-bg text-bad",
  warn: "bg-warn-bg text-warn",
};

/**
 * Pill marking a change made by someone other than the timesheet owner.
 *
 * Mirrors the `.status-pill` shape but in the alarm palette — red is
 * reserved exclusively for "someone else touched your time".
 */
export function CorrectionPill({ children, tone = "bad", title }: CorrectionPillProps) {
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap ${TONE_CLASS[tone]}`}
    >
      {children}
    </span>
  );
}

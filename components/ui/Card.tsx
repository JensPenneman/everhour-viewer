import type { ReactNode } from "react";

export interface KpiCardProps {
  readonly label: string;
  readonly value: ReactNode;
  readonly hint?: string;
  readonly small?: boolean;
}

/**
 * KPI panel — a labelled box with one prominent value and an optional hint.
 * Used in the week-detail header for totals / working days / status.
 */
export function KpiCard({ label, value, hint, small }: KpiCardProps) {
  return (
    <div className="bg-panel border border-border rounded-xl px-4 py-3.5">
      <div className="text-muted text-[11px] uppercase tracking-wider font-medium">{label}</div>
      <div
        className={`${small ? "text-[16px] mt-1.5" : "text-[24px] mt-1"} font-semibold tabular-nums leading-none`}
      >
        {value}
      </div>
      {hint ? <div className="text-muted-soft text-[12px] mt-1.5">{hint}</div> : null}
    </div>
  );
}

export interface PanelProps {
  readonly children: ReactNode;
  readonly className?: string;
}

/** Generic surface (`--panel` background, soft border, rounded). */
export function Panel({ children, className = "" }: PanelProps) {
  return <div className={`bg-panel border border-border rounded-xl ${className}`}>{children}</div>;
}

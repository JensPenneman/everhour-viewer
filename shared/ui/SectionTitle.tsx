import type { ReactNode } from "react";

export interface SectionTitleProps {
  readonly children: ReactNode;
  readonly className?: string;
}

/** Small caps-style section label used between content blocks. */
export function SectionTitle({ children, className = "" }: SectionTitleProps) {
  return (
    <div
      className={`text-[11px] font-semibold uppercase tracking-wider text-muted mb-2.5 ${className}`}
    >
      {children}
    </div>
  );
}

import { statusLabel } from "@/lib/format";
import type { ApprovalStatus } from "@/lib/everhour";

export interface StatusPillProps {
  readonly status: ApprovalStatus | string;
}

export function StatusPill({ status }: StatusPillProps) {
  return <span className={`status-pill ${status}`}>{statusLabel(status)}</span>;
}

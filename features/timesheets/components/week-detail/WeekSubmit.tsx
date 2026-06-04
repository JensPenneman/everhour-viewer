"use client";

import { Button } from "@/shared/ui";
import type { WeekRecord } from "@/lib/everhour";
import type { ToastKind } from "@/shared/hooks";
import { useSubmitWeek } from "../../hooks";

export interface WeekSubmitProps {
  readonly week: WeekRecord;
  /** Push a result toast into the shell's tray. */
  readonly pushToast?: (message: string, kind?: ToastKind) => void;
}

/**
 * The "Week indienen" action — commits the week's timesheet for approval,
 * mirroring Everhour's own submit button.
 *
 * Only rendered when the week is actually submittable (open/rejected + has
 * recorded time); an already-pending or approved week shows nothing here (its
 * status pill already says so). On success the cached week flips to
 * "in afwachting" via the hook's optimistic update and a toast confirms it; on
 * failure (e.g. the API key lacks approval permission) the toast explains it.
 */
export function WeekSubmit({ week, pushToast }: WeekSubmitProps) {
  const { canSubmit, submitting, submit } = useSubmitWeek(week);

  if (!canSubmit) return null;

  const onClick = async () => {
    const { ok, permissionDenied } = await submit();
    if (ok) {
      pushToast?.("Week ingediend ter goedkeuring.", "good");
    } else if (permissionDenied) {
      pushToast?.("Indienen niet toegestaan met deze API-sleutel.", "error");
    } else {
      pushToast?.("Indienen mislukt — probeer het later opnieuw.", "error");
    }
  };

  return (
    <Button
      variant="primary"
      size="sm"
      onClick={onClick}
      disabled={submitting}
      aria-busy={submitting}
    >
      {submitting ? "Bezig met indienen…" : "Week indienen"}
    </Button>
  );
}

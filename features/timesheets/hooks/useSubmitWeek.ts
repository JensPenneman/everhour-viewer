"use client";

import { useCallback, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { errorMessage } from "@/lib/errors";
import { canSubmitWeek, withSubmittedApproval, type WeekRecord } from "@/lib/everhour";
import { everhourStatusOf, useTRPC } from "@/lib/trpc/client";
import { useViewerCache } from "./useViewerCache";

/** The outcome of a submit attempt, resolved from the mutation itself. */
export interface SubmitOutcome {
  readonly ok: boolean;
  /** True when the failure was a 4xx — the key lacks timesheet-approval permission. */
  readonly permissionDenied: boolean;
}

export interface SubmitWeekApi {
  /** Whether the given week can be submitted (open/rejected + has time). */
  readonly canSubmit: boolean;
  /** True while the submission is in flight. */
  readonly submitting: boolean;
  /** Last error message, or null. */
  readonly error: string | null;
  /** Submit the week for approval. Resolves with the outcome (never throws). */
  readonly submit: () => Promise<SubmitOutcome>;
}

/**
 * Owns the "Week indienen" action for a single {@link WeekRecord}: a tRPC
 * mutation (`timesheet.submit`, `retry: false` so a flaky network never
 * double-submits) that, on success, optimistically folds the new approval
 * state into the cached week via {@link withSubmittedApproval} — so the status
 * pill flips to "in afwachting" without a full re-sync.
 *
 * {@link submit} resolves with a {@link SubmitOutcome} derived from the caught
 * error (not React state) so the caller can branch on `permissionDenied`
 * synchronously — the production API key may lack timesheet-approval permission
 * (a 4xx), and we degrade gracefully instead of pretending it landed. Toasts /
 * refetch are left to the caller, matching how the live hooks surface results.
 */
export function useSubmitWeek(week: WeekRecord): SubmitWeekApi {
  const trpc = useTRPC();
  const cache = useViewerCache();
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation(
    trpc.timesheet.submit.mutationOptions({
      retry: false,
      onMutate: () => setError(null),
      onSuccess: (approval) => {
        const at = approval.submittedAt ?? new Date().toISOString().slice(0, 19);
        // Prefer the server's resolved approval; fall back to the optimistic
        // shape if the response history was empty.
        cache.upsertWeek({
          ...withSubmittedApproval(week, at),
          approval: {
            status: approval.status,
            submittedAt: approval.submittedAt,
            history: approval.history.length
              ? approval.history
              : withSubmittedApproval(week, at).approval.history,
          },
        });
      },
      onError: (e) => setError(errorMessage(e) || "Indienen mislukt"),
    }),
  );

  const submit = useCallback(async (): Promise<SubmitOutcome> => {
    try {
      await mutation.mutateAsync({ userId: week.user.id, weekId: week.week.weekId });
      return { ok: true, permissionDenied: false };
    } catch (e) {
      const status = everhourStatusOf(e);
      return { ok: false, permissionDenied: status !== null && status >= 400 && status < 500 };
    }
  }, [mutation, week.user.id, week.week.weekId]);

  return { canSubmit: canSubmitWeek(week), submitting: mutation.isPending, error, submit };
}

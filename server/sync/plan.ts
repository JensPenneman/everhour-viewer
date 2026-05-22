import { isoWeekLabel, type RawTimesheet } from "@/lib/everhour";
import type { KnownWeek } from "./schema";

export interface PlanEntry {
  readonly ts: RawTimesheet;
  readonly isoWeek: string;
  readonly skip: boolean;
}

export interface Plan {
  readonly entries: ReadonlyArray<PlanEntry>;
  readonly toFetch: ReadonlyArray<PlanEntry>;
  readonly toSkip: ReadonlyArray<PlanEntry>;
}

/**
 * Compute which weeks need to be fetched.
 *
 * A week is **skipped** when *all* of the following hold:
 *   - `force` is false,
 *   - the timesheet is submitted (`approval` is present in the response),
 *   - the client already has that week cached with the **same** approval
 *     status (so a transition pending → approved still triggers a refetch).
 *
 * Otherwise the week is fetched. Open weeks (no `approval`) are *always*
 * fetched — they're the in-progress current week and can change every hour.
 */
export function buildPlan(
  timesheets: ReadonlyArray<RawTimesheet>,
  knownWeeks: ReadonlyArray<KnownWeek>,
  force: boolean,
): Plan {
  const known = new Map(knownWeeks.map((k) => [k.isoWeek, k.status]));

  const entries: PlanEntry[] = timesheets.map((ts) => {
    const isoWeek = isoWeekLabel(ts.week.from);
    const knownStatus = known.get(isoWeek);
    const isSubmitted = !!ts.approval;
    const skip =
      !force && knownStatus !== undefined && isSubmitted && knownStatus === ts.approval?.status;
    return { ts, isoWeek, skip };
  });

  const toFetch = entries.filter((e) => !e.skip);
  const toSkip = entries.filter((e) => e.skip);

  return { entries, toFetch, toSkip };
}

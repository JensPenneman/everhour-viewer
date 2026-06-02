import { WEEK_SCHEMA_VERSION, isoWeekLabel, type RawTimesheet } from "@/lib/everhour";
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
 *     status (so a transition pending → approved still triggers a refetch),
 *   - the cached week is at the **current** schema version (an older cache
 *     is refetched so new audit fields backfill without a manual force).
 *
 * Otherwise the week is fetched. Open weeks (no `approval`) are *always*
 * fetched — they're the in-progress current week and can change every hour.
 */
export function buildPlan(
  timesheets: ReadonlyArray<RawTimesheet>,
  knownWeeks: ReadonlyArray<KnownWeek>,
  force: boolean,
): Plan {
  const known = new Map(knownWeeks.map((k) => [k.isoWeek, k]));

  const entries: PlanEntry[] = timesheets.map((ts) => {
    const isoWeek = isoWeekLabel(ts.week.from);
    const cached = known.get(isoWeek);
    const isSubmitted = !!ts.approval;
    const schemaCurrent = (cached?.schemaVersion ?? 0) >= WEEK_SCHEMA_VERSION;
    const skip =
      !force &&
      cached !== undefined &&
      isSubmitted &&
      cached.status === ts.approval?.status &&
      schemaCurrent;
    return { ts, isoWeek, skip };
  });

  const toFetch = entries.filter((e) => !e.skip);
  const toSkip = entries.filter((e) => e.skip);

  return { entries, toFetch, toSkip };
}

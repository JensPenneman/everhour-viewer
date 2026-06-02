/**
 * Wire format for the streaming `/api/sync` endpoint.
 *
 * The event types are defined in `@/lib/sync-protocol` (the shared
 * client/server contract) and re-exported here for the server orchestrator,
 * which also owns the NDJSON serialisation via `writeNdjsonLine`.
 */
export type {
  SyncEvent,
  ProfileEvent,
  PlanEvent,
  SkipEvent,
  WeekEvent,
  DoneEvent,
  ErrorEvent,
  SyncCounts,
} from "@/lib/sync-protocol";

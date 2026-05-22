# Architecture

This document explains the parts of `everhour-viewer` that aren't obvious
from the file tree alone: the sync protocol, the state model, the error
handling, and the boundaries between client and server.

## Layers

The codebase is laid out in concentric layers; outer layers depend on
inner ones, never the other way around.

```
                      ┌───────────────────────────────┐
                      │      app/ (Next.js routes)    │
                      └──────────────┬────────────────┘
                                     │
       ┌─────────────────────────────┴─────────────────────────────┐
       │                                                            │
┌──────▼──────┐                                       ┌─────────────▼──────┐
│  server/    │  ── only imported by app/api/ ──▶     │   components/      │
│  sync/      │  (orchestrator, plan, schema, events) │   viewer/, ui/     │
└──────┬──────┘                                       └─────────────┬──────┘
       │                                                            │
       │                       ┌────────────────────────────────────┘
       │                       │
       ▼                       ▼
                ┌──────────────────────────┐
                │   hooks/                  │
                │   (useApiKey, …)          │
                └──────────────┬───────────┘
                               │
                               ▼
                ┌──────────────────────────┐
                │   lib/                    │
                │   everhour, format,       │
                │   storage, streaming      │
                └──────────────────────────┘
```

- **`lib/`** is framework-agnostic. No React, no Next. Anything that
  could in principle be reused from a CLI or a separate service lives
  here.
- **`server/`** is the only place where Everhour secrets touch the wire.
  Every leaf module in `server/` either imports `server-only` itself or
  transitively imports something that does, so accidentally importing it
  from a Client Component fails at build time.
- **`hooks/`** wraps `lib/` and the Next data-fetching path in
  React-friendly reactive primitives.
- **`components/`** is split into reusable primitives (`ui/`) and the
  app's own widgets (`viewer/`).
- **`app/`** is the Next.js entrypoint. Pages and route handlers are
  intentionally thin — composition + parameter parsing only.

## Sync protocol

Everything interesting happens in `POST /api/sync`. The server streams
back NDJSON; one JSON object per `\n`-terminated line.

### Request

```jsonc
{
  "weeksBack": 78, // 1..260, default 78
  "force": false, // re-fetch even submitted-and-known weeks
  "knownWeeks": [
    // weeks the client already has
    { "isoWeek": "2026-W18", "status": "approved" },
    { "isoWeek": "2026-W19", "status": "pending" },
  ],
}
```

The request body is validated against `server/sync/schema.ts`. Invalid
bodies return `400 invalid_request` with the zod issues array attached.

### Response stream

Lines arrive in this order:

1. **`profile`** — once, immediately after the API key is validated.

   ```jsonc
   { "type": "profile", "profile": { ...sanitised... } }
   ```

2. **`plan`** — once, after the timesheet list is fetched. Lets the
   client switch the progress bar from indeterminate to determinate.

   ```jsonc
   { "type": "plan", "total": 46, "toFetch": 1, "toSkip": 45 }
   ```

3. **`skip`** × _toSkip_ — one per submitted-and-already-cached week.
   Carries no data (the client already has the week); useful for
   diagnostics and for future "what was skipped?" UI.

   ```jsonc
   { "type": "skip", "isoWeek": "2026-W18" }
   ```

4. **`week`** × _toFetch_ — chronological (oldest → newest of `toFetch`),
   `current` / `total` for progress.

   ```jsonc
   {
     "type": "week",
     "current": 1,
     "total": 1,
     "kind": "updated",
     "week": { ...full week shape... }
   }
   ```

5. **`done`** — terminates a successful stream.

   ```jsonc
   {
     "type": "done",
     "counts": { "new": 0, "updated": 1, "skipped": 45, "totalWeeks": 46 },
   }
   ```

6. **`error`** — terminates a failed stream. May appear _after_ some
   `week` events have already been emitted — partial progress is kept by
   the client.

   ```jsonc
   { "type": "error", "message": "...", "status": 502 }
   ```

### Why NDJSON

Server-Sent Events would also work, but require event-name framing on
the client side and don't compose with React Server Components' streaming
in any meaningful way. WebSockets would require a stateful connection
the server doesn't otherwise need. NDJSON over a long-lived
`ReadableStream` is the simplest thing that lets the UI render weeks as
they arrive without polling.

## Delta planning

Implemented in `server/sync/plan.ts`. The algorithm:

```
for ts in timesheets returned by Everhour:
  iso = isoWeekLabel(ts.week.from)
  knownStatus = knownWeeks[iso]
  isSubmitted = ts.approval is present
  skip if:
    force is false
    AND knownStatus is defined
    AND isSubmitted
    AND knownStatus == ts.approval.status
```

This deliberately catches the "approved → rejected" transition (status
changed → refetch) while still avoiding work for the common "still
approved, exactly as we knew it" case.

Open (unsubmitted) weeks are _always_ refetched because they can change
every minute — this is usually just the current week.

## Client state model

State is owned by four custom hooks, composed by `<Viewer>`:

| Hook               | Owns                                             |
| ------------------ | ------------------------------------------------ |
| `useApiKey`        | `hasUserKey`, `hasEnvKey`, hydration state.      |
| `useViewerCache`   | Profile, weeks (persisted), sorted view, totals. |
| `useStreamingSync` | The active sync run + a deduped progress object. |
| `useToasts`        | Toast queue with kind-dependent auto-dismiss.    |

`<Viewer>` itself owns only the cross-cutting UI state: current view
(`empty | profile | week`), active week iso, menu open, dialog open,
file-input ref. Everything else lives in a hook.

### Persistence

`useViewerCache` persists to `localStorage` on every mutation. The shape
is:

```jsonc
{
  "profile": { ...EverhourProfile... } | null,
  "weeks":   [ ...WeekRecord... ]
}
```

The storage key is `everhour_viewer_data_v1`. The trailing `v1` is the
upgrade path: if we ever change the cache shape incompatibly, `v2` is
the right answer rather than trying to detect old data inside the
reader.

The API key lives at `everhour_api_key`, also `localStorage`. It is
**never** persisted to disk by the server and **never** included in any
response body.

## Error model

```
            ┌───────────────────────────┐
            │       EverhourError       │
            │                           │
            │   status: number          │
            │   isRetryable(): boolean  │
            └───────────────────────────┘
              ▲                       ▲
              │                       │
       throws in client.ts       wraps via { cause }
       on non-OK or network         a non-EverhourError
       failure
```

- `status === 0`: network-level failure (DNS, TCP, TLS, fetch threw).
- `status === 429` or `status >= 500`: retryable. The client retries
  three times with linear back-off.
- Other 4xx: surfaced to the caller immediately.

The orchestrator catches all errors and emits a final `error` event
rather than allowing the stream to throw. This is intentional: any
weeks already streamed are valid; we want the client to keep them.

## Validation boundary

Zod validates every inbound API body in `app/api/sync/route.ts`. The
parsed object is then handed to `server/sync/orchestrator.ts`, which can
trust its shape.

Outbound events are typed but not validated — the orchestrator emits
objects whose shape is enforced by the TypeScript types in
`server/sync/events.ts`. The client uses the same types to parse them.
This is acceptable because both sides are this codebase; a third-party
consumer would justify outbound validation.

## Testing strategy

- **Unit (Vitest)** — every pure function in `lib/` and `server/sync/`
  has tests. Run as `npm run test`. Fast (sub-second), no browser.
- **E2E (Playwright)** — drive the real UI against a route-mocked
  `/api/sync` endpoint. The mock emits deterministic NDJSON so tests
  don't depend on real timesheet data or on the Everhour API being up.
  Run as `npm run test:e2e`.
- **Screenshots (Playwright via `scripts/shoot.mjs`)** — drives the
  real app (real `/api/sync` against real Everhour) and saves PNGs.
  Used during UI iteration, not part of CI.

## Conventions

- File names match the primary export: `Button.tsx` → `export function Button`.
- Barrel files (`index.ts`) for stable public surfaces of `lib/`,
  `components/ui/`, `components/viewer/`, `hooks/`, `server/sync/`.
- `interface` for object shapes, `type` for unions and aliases. Readonly
  everywhere we can get away with it.
- Tailwind classes inlined; reusable patterns go through component
  props, not utility class composition.
- No `console.log` outside scripts (lint-enforced via `no-console`).

## Things deliberately not added

- **State library** (Redux, Zustand). `useState` + a handful of custom
  hooks cover the surface area without ceremony.
- **CSS-in-JS / styled-components**. Tailwind v4 with CSS variables
  reaches the same destination with fewer dependencies.
- **Server-side database**. The "hosted-once, BYO key, your data lives
  in your browser" model is the product, not a limitation.
- **GraphQL / tRPC**. A single streaming endpoint doesn't justify it.

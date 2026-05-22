# Development guide

## Prerequisites

- Node 20+ (see [`.nvmrc`](../.nvmrc)).
- A real Everhour account is **not** required for development — the unit
  tests run pure-Node and the E2E tests stub the API. You only need a
  key if you want to drive the live UI via `npm run shoot`.

## First-time setup

```bash
git clone https://github.com/JensPenneman/everhour-viewer.git
cd everhour-viewer
nvm use            # or: corepack enable && nvm install $(cat .nvmrc)
npm install        # also installs husky hooks via `prepare`
cp .env.local.example .env.local
# optional: paste your key into EVERHOUR_API_KEY=
npm run dev
```

## Day-to-day

```bash
npm run dev              # http://localhost:3000
npm run test:watch       # Vitest in watch mode
npm run typecheck        # strict TypeScript, no emit
npm run lint             # ESLint
npm run format           # Prettier --write
```

Before pushing, husky's `pre-push` hook runs `npm run typecheck && npm
run test`. CI re-runs the full gate (`npm run check` + e2e).

## Adding a new component

1. If it's generic enough to belong in a primitive library, add it to
   [`components/ui/`](../components/ui/) and re-export from
   [`components/ui/index.ts`](../components/ui/index.ts).
2. If it's specific to the viewer, add it to
   [`components/viewer/`](../components/viewer/). Sub-areas (e.g.
   `week-detail/`) get their own subdirectory with an `index.ts`.
3. Mark the component `"use client"` only if it actually uses hooks /
   event handlers; leave it server-rendered otherwise.

## Adding a new hook

1. Live in [`hooks/`](../hooks/) with a `useThing.ts` name.
2. Re-export from [`hooks/index.ts`](../hooks/index.ts).
3. Return a single API object (`useViewerCache` is the canonical
   shape), not a tuple. Stable references via `useCallback` /
   `useMemo`.

## Adding a new lib module

1. Pick a subdirectory: `everhour/`, `format/`, `storage/`,
   `streaming/`, or create a new one if there's a clear theme.
2. Frame-agnostic only. No React, no Next imports. Pure data and
   functions.
3. Add unit tests in [`tests/unit/`](../tests/unit/) mirroring the
   source path: `lib/format/foo.ts` → `tests/unit/format/foo.test.ts`.

## Working on the sync orchestrator

`server/sync/orchestrator.ts` is the streaming pipeline. The plan
computation is isolated in `server/sync/plan.ts` and is independently
unit-tested. When changing the protocol:

1. Update the event types in `server/sync/events.ts` first.
2. Update the orchestrator emission and the client consumer
   (`hooks/useStreamingSync.ts`) in the same change.
3. Add a unit test that walks the plan logic for the new edge case
   (`tests/unit/server/plan.test.ts`).
4. Add an E2E test in `tests/e2e/sync.spec.ts` that stubs the new event
   shape and asserts the UI behaves.

## Working on the UI

For UI iteration, run `npm run shoot` to capture every screen against
the real API. Screenshots land in `screenshots/` (gitignored — they
contain real timesheet data).

Manual smoke test list:

1. Welcome → key dialog → save key → close. Key in `localStorage`.
2. Welcome → Synchroniseer → progress bar visible → first week appears
   in sidebar mid-stream → main pane auto-selects first week.
3. Synchroniseer again → "0 nieuw · 0 bijgewerkt · N ongewijzigd" toast.
4. Menu → Backup downloaden → JSON downloads, contains all weeks.
5. Menu → Cache wissen → confirmation → back to Welcome.
6. Menu → Backup laden → pick the JSON from step 4 → state restored.
7. `↑`/`↓` (or `j`/`k`) navigates between weeks.

## Releasing

There is no release process — this is a private/personal tool. Tag if
you want; nothing depends on it.

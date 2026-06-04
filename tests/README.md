# Tests

Two layers, run separately:

| Command            | What it runs                                  |
| ------------------ | --------------------------------------------- |
| `npm test`         | Vitest unit tests (`tests/unit/**`), `TZ=UTC` |
| `npm run test:e2e` | Playwright end-to-end specs (`tests/e2e/**`)  |
| `npm run check`    | typecheck + lint + format:check + unit        |

## Layout

```
tests/
  unit/        Vitest. Pure logic, organised by domain (everhour, live, server, …).
               No DOM, no network — each file targets one module.
  e2e/         Playwright. One spec per user-facing surface, against a fully
               mocked backend (no real Everhour calls).
    support/   Shared e2e infrastructure — specs import everything from "./support":
      fixtures.ts  Canonical mock data: testProfile(), makeWeek(), timers, MOCK_TASK.
                   Typed against the real domain types, so a schema change is a
                   compile error here, not silent drift across specs.
      mocks.ts     Network mocking: mockSync() (NDJSON /api/sync), mockLive() /
                   mockLiveTimer() (the live tRPC procedures).
      app.ts       Page actions: clearStorage(), startSync(), gotoVandaag(),
                   gotoWeek(), sidebar().
      trpc.ts      Low-level mock for the tRPC httpBatchLink wire format.
      index.ts     Barrel.
  stubs/       Module stubs for unit tests (e.g. `server-only` → no-op). Wired in
               vitest.config.ts.
```

## Conventions

- Selectors are role/text based (`getByRole`, `getByText`) — no `data-testid`.
- Unit tests import `{ describe, it, expect }` from `vitest` (no globals).
- E2E specs contain only their scenario; all data/mocks/navigation come from
  `support`. Add a new fixture or page action there rather than inline in a spec.

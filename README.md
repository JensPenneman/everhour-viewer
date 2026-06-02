# everhour-viewer

A local **NextJS** app for [Everhour](https://everhour.com): a live tracker
(start/stop timers, day/week targets) **and** a timesheet viewer (history,
edit audit, backups). Bring-your-own-key, everything cached in the browser.

<div>

[![CI](https://github.com/JensPenneman/everhour-viewer/actions/workflows/ci.yml/badge.svg)](https://github.com/JensPenneman/everhour-viewer/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

</div>

## Features

- **Live tracking (Vandaag).** The default landing: start/stop a timer on
  any task (search or one-tap a recent one), with a live-ticking elapsed
  clock, attendance clock status, today's entries, and two progress
  meters — time left to a full **8u** day and to the full **40u** week
  (both counting the running timer in real time). Mutations proxy through
  the server with the same key model and never auto-retry.
- **Viewer.** Week/day history, the edit-correction audit trail, and
  exportable backups — reachable from the sidebar.
- **Bring your own key.** Each visitor pastes their own Everhour API key.
  Stored in `localStorage`, forwarded to the server via header on each
  request — the server never persists it.
- **Delta sync.** The client tells the server which weeks it has and at
  which approval status. The server fetches details only for new or
  status-changed weeks. A first sync is one minute; subsequent syncs
  finish in seconds.
- **Streamed.** Sync responds with NDJSON; the sidebar fills and the
  first week becomes browseable while the rest is still in flight.
- **Local-first.** All data lives in the browser. There is no database.
- **Exportable.** One-click backup downloads the full cache as a single
  JSON file. Re-importable.
- **Dutch UI.** Status pills, weekdays, and dates render in Dutch.
  Centralised in [`lib/format/nl.ts`](lib/format/nl.ts) if you need to
  swap locales.

## Quick start

```bash
cp .env.local.example .env.local   # optional — for the dev fallback key
npm install
npm run dev
```

Open <http://localhost:3000>. Paste your API key on the welcome screen
(or rely on `EVERHOUR_API_KEY` in `.env.local`), then click
**Synchroniseer**.

Get a key from Everhour's settings: **Settings → Application Access**
([https://app.everhour.com/#/account/profile](https://app.everhour.com/#/account/profile)).

## Scripts

| Script                  | What it does                                                                           |
| ----------------------- | -------------------------------------------------------------------------------------- |
| `npm run dev`           | Start the Next dev server.                                                             |
| `npm run build`         | Production build.                                                                      |
| `npm start`             | Run the production build.                                                              |
| `npm run lint`          | ESLint (Next + TS + Prettier-compatible).                                              |
| `npm run lint:fix`      | ESLint with `--fix`.                                                                   |
| `npm run typecheck`     | `tsc --noEmit` against the strict project config.                                      |
| `npm run format`        | Format the repo with Prettier.                                                         |
| `npm run format:check`  | Verify Prettier formatting (CI gate).                                                  |
| `npm run test`          | Vitest unit tests (pure-Node).                                                         |
| `npm run test:watch`    | Vitest in watch mode.                                                                  |
| `npm run test:coverage` | Coverage report via `@vitest/coverage-v8`.                                             |
| `npm run test:e2e`      | Playwright E2E suite (auto-starts the dev server).                                     |
| `npm run test:e2e:ui`   | Playwright in interactive UI mode.                                                     |
| `npm run shoot`         | Drive a real (or stubbed) browser through every screen and snapshot to `screenshots/`. |
| `npm run lighthouse`    | Build, audit with Lighthouse (desktop), and fail unless every category is green (≥90). |
| `npm run check`         | One-shot CI gate: typecheck + lint + format + unit tests.                              |

Pre-commit (`husky` + `lint-staged`) runs Prettier + ESLint on staged files
only. Pre-push runs `typecheck` + `test`.

## Project layout

The frontend is organised into **feature modules**; cross-cutting code lives
in `shared/` and the framework-agnostic kernel in `lib/`. The backend is
three layers (data → service → route). An ESLint rule keeps the dependency
graph one-directional: the kernel never imports features, and `server/` never
imports client code.

```
everhour-viewer/
├── app/                          # Next.js App Router
│   ├── api/{sync,timer,tasks,    # thin routes: resolveKey → zod validate
│   │        clock,time}/route.ts #            → service → respond
│   ├── providers.tsx             # TanStack Query client + localStorage persistence
│   ├── layout.tsx                # mounts <AppProviders><Viewer/></AppProviders>
│   └── [[...slug]]/page.tsx      # renders null; the URL alone drives the view
├── features/                     # feature modules (components/ hooks/ [lib/] index.ts)
│   ├── live/                     # Vandaag — timers, clock, day/week targets
│   ├── timesheets/               # the viewer — week + day-detail, edit audit, cache store
│   ├── sync/                     # streaming NDJSON sync + backup import/export
│   └── events/                   # day-event overlay UI + hook (holidays / ICS)
├── shared/
│   ├── ui/                       # design-system primitives (Button, Dialog, …)
│   ├── hooks/                    # cross-cutting hooks (apiKey, toasts, nav, transitions)
│   └── components/               # the app shell (Viewer, Header, Sidebar, …)
├── lib/                          # shared kernel (framework-agnostic)
│   ├── everhour/                 # domain types, errors, iso-week, transforms
│   ├── format/                   # dates/times (date-fns), Dutch i18n
│   ├── query/                    # TanStack Query client, persister, keys, fetcher
│   ├── storage/                  # typed localStorage (api key, day events)
│   ├── events/ · providers/      # day-event domain + provider registry
│   ├── streaming/                # NDJSON reader/writer
│   ├── json.ts · errors.ts       # JsonValue, error guards
│   └── sync-protocol.ts          # NDJSON wire-event types (client/server contract)
├── server/                       # server-only (import "server-only")
│   ├── everhour/                 # DATA layer: HTTP client + Everhour ops
│   ├── services/                 # BUSINESS layer: timer / tasks / clock / time
│   ├── validation/               # zod request schemas
│   ├── sync/                     # delta plan + streaming orchestrator
│   └── http.ts                   # route kit (resolveKey, error mapping)
├── tests/ {unit, e2e, stubs}
├── docs/architecture.md          # system design + sync protocol
└── playwright.config.ts · vitest.config.ts · package.json
```

State + server I/O flow through **TanStack Query** (the cache is persisted to
`localStorage`, so weeks browse offline); the three real tables use
**TanStack Table**; dates go through **date-fns**.

See [`docs/architecture.md`](docs/architecture.md) for a deeper walk-through
of the sync protocol, error model, and state flow.

## Architecture in one diagram

```
                       browser tab
                       ┌────────────────────────────────────────────┐
                       │ Viewer ← useViewerCache ← TanStack Query    │
                       │   ↑                         ↕ persisted      │
                       │ useStreamingSync          localStorage       │
                       └──────┬──────────────────────────────────────┘
                              │ POST /api/sync   ──knownWeeks──▶
                              │   x-everhour-key
                              │
                       ┌──────▼──────────────────────────────────────┐
                       │ app/api/sync/route.ts                        │
                       │   ↓ zod validate                             │
                       │ server/sync/orchestrator.ts                  │
                       │   ↓ buildPlan() — decides skip vs fetch      │
                       │   ↓ stream NDJSON: profile | plan |          │
                       │     week×N | done                            │
                       └──────┬──────────────────────────────────────┘
                              │ retry + back-off
                              ▼
                          api.everhour.com
```

## Configuration

### Environment variables

| Variable           | Purpose                                                                                                                                    |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `EVERHOUR_API_KEY` | Optional server-side fallback. If present, sync works without a user-supplied key. **Not required.** Used only as a developer convenience. |

The user-supplied key always takes priority over the env-key when present.

### Tailwind / theme

Colours live as CSS variables in [`app/globals.css`](app/globals.css). The
`@theme inline` block exposes them as Tailwind classes (`bg-panel`,
`text-muted`, etc.). The code currently uses the explicit
`bg-[var(--panel)]` form for grep-ability; both work.

## Testing

Two layers:

1. **Unit tests** (`vitest`, `tests/unit/`) — cover all framework-agnostic
   logic: iso-week math, week building, profile sanitisation, delta plan,
   schema validation, NDJSON reader/writer.
2. **E2E tests** (`@playwright/test`, `tests/e2e/`) — drive the real UI
   against a **mocked** `/api/sync` endpoint so they don't depend on the
   live Everhour API.

The dev screenshot driver (`npm run shoot`) is separate — it hits the
real API and is useful for visual regression while iterating on UI.

## CI

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs on every push
and PR:

1. **`lint-typecheck-test`** — Prettier check, ESLint, `tsc --noEmit`,
   Vitest, `next build`.
2. **`e2e`** — Playwright against the production build, browsers
   installed inside the runner. Reports uploaded as an artifact on
   failure.
3. **`lighthouse`** — builds, serves the production app, and runs
   Lighthouse (desktop). The job fails unless **every** category
   (performance, accessibility, best-practices, SEO) is in the green
   band (≥ 90). Run it locally with `npm run lighthouse`.

## Security notes

- The Everhour API key is **never** logged or returned in any response
  body. The GET-probe of `/api/sync` returns `{ hasEnvKey: boolean }`
  and nothing else.
- `.env.local` is gitignored (`.env*` with one exception for the
  `.env.local.example` template).
- Backup downloads contain real timesheet data. Treat them like any
  other personal export.

## License

MIT — see [`LICENSE`](LICENSE).

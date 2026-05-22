# everhour-viewer

A local **NextJS** app to view [Everhour](https://everhour.com) timesheets.
Bring-your-own-key, delta-streaming sync, everything cached in the browser.

<div>

[![CI](https://github.com/JensPenneman/everhour-viewer/actions/workflows/ci.yml/badge.svg)](https://github.com/JensPenneman/everhour-viewer/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

</div>

## Features

- **Bring your own key.** Each visitor pastes their own Everhour API key.
  Stored in `localStorage`, forwarded to the server via header on each
  sync — the server never persists it.
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
| `npm run check`         | One-shot CI gate: typecheck + lint + format + unit tests.                              |

Pre-commit (`husky` + `lint-staged`) runs Prettier + ESLint on staged files
only. Pre-push runs `typecheck` + `test`.

## Project layout

```
everhour-viewer/
├── app/                            # Next.js App Router
│   ├── api/sync/route.ts           # Thin adapter → server/sync/orchestrator
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx                    # Renders <Viewer />
├── components/
│   ├── ui/                         # Generic primitives (Button, Dialog, Menu, …)
│   └── viewer/                     # App-specific components
│       └── week-detail/            # KPI cards, daily chart, task table, day breakdown
├── hooks/                          # Custom React hooks
│   ├── useApiKey.ts
│   ├── useKeyboardNav.ts
│   ├── useStreamingSync.ts
│   ├── useToasts.ts
│   └── useViewerCache.ts
├── lib/                            # Framework-agnostic, pure logic
│   ├── everhour/                   # Domain types, HTTP client, transforms, errors
│   ├── format/                     # Dates, times, Dutch i18n
│   ├── storage/                    # Typed localStorage wrappers
│   ├── streaming/                  # NDJSON reader/writer
│   └── backup.ts                   # Backup serialisation + file import
├── server/                         # Server-only code (import "server-only")
│   └── sync/                       # Delta plan + streaming orchestrator + zod schemas
├── scripts/                        # Dev scripts (e.g. screenshot driver)
├── tests/
│   ├── unit/                       # Vitest, Node env
│   ├── e2e/                        # Playwright, Chromium
│   └── stubs/                      # `server-only` shim for unit tests
├── docs/
│   └── architecture.md             # System design + sync protocol
├── playwright.config.ts
├── vitest.config.ts
└── package.json
```

See [`docs/architecture.md`](docs/architecture.md) for a deeper walk-through
of the sync protocol, error model, and state flow.

## Architecture in one diagram

```
                       browser tab
                       ┌────────────────────────────────────────────┐
                       │ Viewer  ←  useViewerCache  ←  localStorage │
                       │   ↑                                         │
                       │ useStreamingSync                            │
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

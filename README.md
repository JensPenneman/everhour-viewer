# Everhour viewer

A small NextJS app to view Everhour timesheets. Designed to run locally or be
hosted once — each browser holds its own data and its own API key, nothing is
shared server-side.

## What it does

- **Per-browser key.** Each visitor pastes their own Everhour API key. It's
  kept in `localStorage` and forwarded with every sync request via header.
- **Delta sync.** The client sends the weeks it already has and their
  approval status. The server skips fetching details for submitted weeks
  that haven't changed and only pulls new or still-open weeks.
- **Streamed sync.** Sync responses are NDJSON — profile, plan, then
  per-week events stream back, so the sidebar fills and the first week
  becomes visible while the rest is still being fetched.
- **Local cache.** All data lives in the browser's `localStorage`; nothing
  is written to the server filesystem.
- **Downloadable backup.** Export the full cache (profile + all weeks) as
  a single JSON file via the header menu.

## Setup

```bash
npm install
cp .env.local.example .env.local   # optional — see "API key" below
npm run dev
```

Open <http://localhost:3000> and paste your key on the welcome screen.

## API key

There are two ways to supply a key:

1. **In the browser** (recommended for any non-local use): click *API-sleutel*
   in the header menu. The value lives in `localStorage` only and is sent
   with each `/api/sync` request via the `x-everhour-key` header.
2. **In `.env.local`**: set `EVERHOUR_API_KEY=...`. The server uses this as
   a fallback when no browser-supplied key is present. Convenient for local
   dev; do **not** ship this on a public deploy.

Get a key at <https://app.everhour.com/account#api>.

## Keyboard

- `↑` / `k` — previous week
- `↓` / `j` — next week

## Architecture sketch

```
browser localStorage  ──knownWeeks──▶  POST /api/sync  ──▶  Everhour API
       ◀────────── NDJSON stream (profile, plan, week×N, done) ──────────
```

Each NDJSON event is consumed as it arrives — see `app/Viewer.tsx`. The
server-side sync orchestration is in `app/api/sync/route.ts`; the Everhour
HTTP wrapper and data shape live in `lib/everhour.ts`.

## Screenshots

`npm run shoot` (after starting the dev server) drives the app through its
empty, sync-in-progress, and post-sync states with headless Chrome and
saves PNGs to `screenshots/`.

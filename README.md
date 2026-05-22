# Everhour viewer

A small local NextJS app to view my Everhour timesheets. Replaces an older
`viewer.html` + `sync.py` pair with a single dev-server.

## What it does

- Pulls profile + the last 78 weeks of timesheets from Everhour (via an
  internal API route, so the key stays on the server side).
- Renders a sidebar with all weeks and a detail view per week: KPI cards,
  daily bar chart, per-ticket totals, and an expandable per-day breakdown.
- Caches the result in `localStorage` so a refresh doesn't re-fetch.
- Can also load JSON files exported by the old `sync.py` (drag them onto
  the "Laden" button).

## Setup

```bash
npm install
cp .env.local.example .env.local
# edit .env.local: EVERHOUR_API_KEY=...
npm run dev
```

Then open <http://localhost:3000>.

You can also leave `.env.local` empty and paste a key at runtime via the
"API-sleutel" button — it lives in `localStorage` and is forwarded to the
sync route via header.

## Keyboard

- `↑` / `k` — previous week
- `↓` / `j` — next week

## Notes

- API key is never written to disk by the app and never sent to the browser
  (when sourced from `.env.local`).
- `.env.local` is gitignored.
- There's no production deploy — this is a local-only tool.

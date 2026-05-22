# API reference

The only HTTP surface is `/api/sync`.

## `GET /api/sync`

Capability probe. Returns whether the server has a dev-mode env key
configured. **Never returns the key itself.**

### Response

```jsonc
200 OK
{ "hasEnvKey": true }
```

## `POST /api/sync`

Run a delta sync. Responds with a streaming `application/x-ndjson` body.

### Headers

| Header           | Required    | Meaning                                                                                      |
| ---------------- | ----------- | -------------------------------------------------------------------------------------------- |
| `x-everhour-key` | Conditional | The Everhour API key. Optional if the server has `EVERHOUR_API_KEY` set; required otherwise. |
| `Content-Type`   | Yes         | `application/json`.                                                                          |

### Request body

```jsonc
{
  "weeksBack": 78, // optional, 1..260, default 78
  "force": false, // optional, default false
  "knownWeeks": [
    // optional, default []
    { "isoWeek": "2026-W18", "status": "approved" },
  ],
}
```

Validated by `SyncRequestSchema` in `server/sync/schema.ts`. Unknown
fields are rejected (`strict()`).

### Response (success)

```http
200 OK
Content-Type: application/x-ndjson; charset=utf-8
Cache-Control: no-store, no-transform
X-Accel-Buffering: no
```

Body is a sequence of newline-terminated JSON objects. See
[`docs/architecture.md`](architecture.md#sync-protocol) for the full
event ordering and shapes.

### Response (error)

| Status | Body                                              | Meaning                                                                      |
| ------ | ------------------------------------------------- | ---------------------------------------------------------------------------- |
| `400`  | `{ "error": "no_api_key" }`                       | No key in header or env.                                                     |
| `400`  | `{ "error": "invalid_request", "issues": [...] }` | Body failed zod validation. The `issues` array is zod's standard issue list. |

Note: per-week / mid-stream failures (e.g. Everhour rate-limit during
the streaming phase) are surfaced as a final `{ "type": "error" }`
NDJSON line, **not** as an HTTP error. The HTTP status remains 200 and
any weeks already streamed are still valid.

## Data shapes

All canonical types live in [`lib/everhour/types.ts`](../lib/everhour/types.ts):

- `EverhourProfile` — sanitised `/users/me` response.
- `WeekRecord` — one week of the cache: range, approval, totals, days.
- `WeekDay` — one day inside a `WeekRecord`.
- `WeekEntry` — one task-time entry inside a `WeekDay`.
- `BackupFile` — the shape of the file produced by the in-browser
  "Backup downloaden" action. Re-importable via the file picker.

Every type is `readonly`-recursive — the cache is treated as immutable;
mutations go through `useViewerCache` setters.

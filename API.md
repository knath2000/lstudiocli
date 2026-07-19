# API contract

All endpoints except `GET /health` require `Authorization: Bearer $LUSTRE_TOKEN` (or `X-Lustre-Token`).

| Method | Path | Meaning |
|---|---|---|
| POST | `/api/jobs` | `{url, quality?}` creates a queued intent |
| GET | `/api/jobs` | list queue |
| GET | `/api/jobs/:id` | job plus extraction/transfer traces |
| POST | `/api/jobs/:id/{retry,pause,resume,cancel}` | state transition |

The create response is `201` with a job. Invalid or non-public URLs return `400`; missing/invalid tokens return `401`.

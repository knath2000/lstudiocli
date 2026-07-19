# API contract

All endpoints except `GET /health` require `Authorization: Bearer $LUSTRE_TOKEN` (or `X-Lustre-Token`).

| Method | Path | Meaning |
|---|---|---|
| POST | `/api/jobs` | `{url, quality?, localVerification?}` creates a queued intent; `localVerification` creates a paused local-browser handoff job |
| GET | `/api/jobs` | list queue |
| GET | `/api/jobs/:id` | job plus extraction/transfer traces |
| POST | `/api/jobs/:id/{retry,pause,resume,cancel}` | state transition |
| POST | `/api/jobs/:id/verified-source` | authenticated one-time local-browser media handoff; source details are forwarded only to the worker’s memory |

The create response is `201` with a job. Invalid or non-public URLs return `400`; missing/invalid tokens return `401`.

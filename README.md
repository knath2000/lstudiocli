# lustrestudio-server

Self-hosted Linux seedbox downloader: a token-protected local UI/API and CLI controlling a durable SQLite queue. Jobs retain the primary page URL and preferred quality only; the worker resolves a fresh media source when each attempt begins.

## Layout

- `packages/core`: schema, queue recovery, URL guard, resolver contract and staged downloader
- `packages/api`: Fastify API plus responsive single-page UI
- `packages/worker`: persistent concurrent executor
- `packages/cli`: `lustre` command client
- `migrations/001_initial.sql`: inspectable database schema

## Local development

```sh
cp .env.example .env
# Set LUSTRE_TOKEN to a long random value.
npm install
npm test
npm run dev
```

Open `http://127.0.0.1:8787`; the UI requests the token once and stores it in browser local storage. In another shell:

```sh
export LUSTRE_TOKEN='the-value-from-.env'
npx tsx packages/cli/src/index.ts add https://example.com/demo 1080p
npx tsx packages/cli/src/index.ts queue
npx tsx packages/cli/src/index.ts logs JOB_ID
```

The deliberate vertical-slice resolver recognizes `example.com` and downloads a stable test PNG. It is the only mock extraction behavior; no real provider scraping is included yet. The UI shell is intentionally public only on the local bind; every API request, including the queue data it renders, requires the token.

## Deployment

```sh
cp .env.example .env
# edit token and absolute bind-mounted download directory if desired
docker compose up -d --build
```

Docker binds **only** to `127.0.0.1`. For remote access, use Tailscale with the service still loopback-bound and a Tailscale Serve/Funnel policy that requires your tailnet identity, or an SSH tunnel:

```sh
ssh -N -L 8787:127.0.0.1:8787 seedbox.example
```

For systemd, create a `lustre` user, install this repository under `/opt/lustrestudio-server`, place the environment file at `/etc/lustrestudio-server.env` with mode `0600`, then install `deploy/lustrestudio-server.service`. Do not bind to a public interface without a reverse proxy, TLS, and authentication.

## Architecture and provider roadmap

`QueueWorker` claims jobs atomically, changes interrupted `running` jobs back to `queued` at startup, and resolves every source anew. Resolvers return a source plus required request headers. The downloader stages to `.part`, rejects HTML/JSON/XML and tiny bodies, validates byte count, then atomically renames within the configured root. Traces redact URLs, cookies, and authorization values.

Next: add Playwright as an optional resolver runner with encrypted cookie storage, SSRF-safe redirect/DNS checks, adapter metadata/aliases from configuration, Dood/Playmogo and MixDrop adapters, streaming progress, exponential retry scheduling, and integration tests with local HTTP fixtures. Keep signed URLs only in process memory; never write them to SQLite or traces.

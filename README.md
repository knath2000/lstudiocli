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

The worker tries direct-file, Playmogo/Dood, MixDrop, then Playwright Chromium media-request capture. The browser fallback keeps browser cookies and final media URLs in memory only; traces record the resolver and stage but redact URL/cookie secrets. The UI has a server-folder picker constrained to `LUSTRE_DOWNLOAD_ROOT`, so downloads cannot escape the configured root. The UI shell is intentionally public only on the local bind; every API request, including the queue data it renders, requires the token.

### Chrome verification extension

Load `packages/chrome-extension` as an unpacked Chrome extension, then open its options and save the seedbox URL plus API token. When **Verify in my local Chrome** is selected, the extension opens the provider page in your normal Chrome profile. After you complete the provider’s normal verification and start playback, it sends one media request and the required context through the authenticated API. Signed URLs and cookies are never written to the queue database or logs.

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

### Provider verification browser

The Docker deployment includes a persistent Chromium profile exposed through noVNC at `/verify/vnc.html`. Put it behind a reverse proxy that requires authentication; this deployment uses HTTP Basic auth with username `lustre-verify` and the existing API token as the password. Complete provider verification yourself in that browser, close the tab, then retry the job. The worker attaches to the same profile to reuse the resulting session cookies. It does not automate challenges or CAPTCHA solving.

For systemd, create a `lustre` user, install this repository under `/opt/lustrestudio-server`, place the environment file at `/etc/lustrestudio-server.env` with mode `0600`, then install `deploy/lustrestudio-server.service`. Do not bind to a public interface without a reverse proxy, TLS, and authentication.

## Architecture and provider roadmap

`QueueWorker` claims jobs atomically, changes interrupted `running` jobs back to `queued` at startup, and resolves every source anew. Resolvers return a source plus required request headers. The downloader stages to `.part`, rejects HTML/JSON/XML and tiny bodies, validates byte count, then atomically renames within the configured root. Traces redact URLs, cookies, and authorization values.

Next: add Playwright as an optional resolver runner with encrypted cookie storage, SSRF-safe redirect/DNS checks, adapter metadata/aliases from configuration, Dood/Playmogo and MixDrop adapters, streaming progress, exponential retry scheduling, and integration tests with local HTTP fixtures. Keep signed URLs only in process memory; never write them to SQLite or traces.

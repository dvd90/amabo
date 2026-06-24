# Deploying Amabo on Railway (two services)

Amabo deploys as **two Railway services from this one repo** — a Node **API** and a
static **web** PWA — plus a managed **Postgres**. They run on different origins, so the
API is configured for credentialed CORS + `SameSite=None` cookies (handled for you via
env vars below).

```
Railway project "amabo"
├── Postgres            (managed plugin → injects DATABASE_URL)
├── amabo-api           (config: railway.api.json)   → https://amabo-api.up.railway.app
└── amabo-web           (config: railway.web.json)   → https://amabo-web.up.railway.app
```

Each service reads its **own config file** (`railway.api.json` / `railway.web.json`)
already in the repo — Railway uses one config file per service.

---

## Step 0 — Prerequisites

- The repo is on GitHub (`dvd90/amabo`) and `main` is up to date.
- You'll create **3 things** in one Railway project: Postgres, the API service, the web service.

## Step 1 — Create the project + Postgres

1. Railway → **New Project → Deploy from GitHub repo** → pick `dvd90/amabo` (branch `main`).
   Railway will create one service to start — we'll set it up as the API in Step 2.
2. In the project: **New → Database → Add PostgreSQL**. This injects **`DATABASE_URL`**.

## Step 2 — Configure the **API** service (`amabo-api`)

1. Open the service Railway created from the repo → **Settings**.
2. **Config-as-code → Config Path:** set to `railway.api.json`.
3. **Settings → Networking → Generate Domain** (note the URL, e.g. `https://amabo-api.up.railway.app`).
4. **Variables** → add:

   | Variable              | Required   | Value / notes                                                                                          |
   | --------------------- | ---------- | ------------------------------------------------------------------------------------------------------ |
   | `NODE_ENV`            | ✅         | `production` — enables Secure cookies, trust-proxy, and `SameSite=None`                                |
   | `DATABASE_URL`        | ✅         | `${{ Postgres.DATABASE_URL }}` (reference the Postgres service)                                        |
   | `BASE_URL`            | ✅         | the **API's own** URL, e.g. `https://amabo-api.up.railway.app` (OAuth redirect + share links)          |
   | `WEB_ORIGIN`          | ✅         | the **web app's** URL, e.g. `https://amabo-web.up.railway.app` (CORS allow-list + post-login redirect) |
   | `ANTHROPIC_API_KEY`   | optional   | omit → local templated narrator (zero AI cost)                                                         |
   | `GOOGLE_OAUTH_ID`     | optional\* | Google OAuth client ID                                                                                 |
   | `GOOGLE_OAUTH_SECRET` | optional\* | Google OAuth client secret                                                                             |

   \*Without the Google vars the API uses a **fake** auth provider (local/testing only) —
   set them for real sign-in.

   > Chicken/egg: you need the web URL for `WEB_ORIGIN`. Either create the web service
   > first to get its domain (Step 3), or set a placeholder now and update `WEB_ORIGIN`
   > after Step 3, then redeploy the API.

5. Deploy. On build Railway runs `pnpm build`, the **release step** `drizzle-kit migrate`,
   then starts the API. Check `GET https://<api-url>/health` → `{ "ok": true }`.

## Step 3 — Add the **web** service (`amabo-web`)

1. Project → **New → GitHub Repo** → same repo `dvd90/amabo` (branch `main`).
2. The new service → **Settings → Config-as-code → Config Path:** `railway.web.json`.
3. **Settings → Networking → Generate Domain** (e.g. `https://amabo-web.up.railway.app`).
4. **Variables** → add (note: this is a **build-time** var — Vite inlines it):

   | Variable        | Required | Value / notes                                              |
   | --------------- | -------- | ---------------------------------------------------------- |
   | `VITE_API_BASE` | ✅       | the **API's** URL, e.g. `https://amabo-api.up.railway.app` |

5. Deploy. Railway builds the PWA (`vite build`) and serves `dist/` via `serve -s` on `$PORT`.

## Step 4 — Wire the cross-links

1. Back on **amabo-api** → confirm `WEB_ORIGIN` = the web service URL (Step 3.3). Redeploy if you changed it.
2. **Google OAuth** (if using real sign-in): in Google Cloud Console → your OAuth client →
   **Authorized redirect URIs** add `https://<api-url>/auth/callback`.

## Step 5 — Verify

- `https://<web-url>/` → the device loads ("Sign in to open the Amarium").
- Sign in → Google → you land back on the web app, signed in (`/me` works cross-origin).
- Create a creature, peek, care — all calls go to the API with the session cookie.

---

## Environment variables — quick reference

**amabo-api**

```
NODE_ENV=production
DATABASE_URL=${{ Postgres.DATABASE_URL }}
BASE_URL=https://amabo-api.up.railway.app
WEB_ORIGIN=https://amabo-web.up.railway.app
# optional:
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_OAUTH_ID=...
GOOGLE_OAUTH_SECRET=...
```

**amabo-web**

```
VITE_API_BASE=https://amabo-api.up.railway.app
```

> `PORT` is injected by Railway for both services — don't set it.

## How it works across origins

- The API allows exactly `WEB_ORIGIN` via CORS with credentials, and accepts the
  `X-CSRF-Token` header (double-submit CSRF).
- In production cookies are `Secure; SameSite=None` so they ride cross-site XHR; both
  services are HTTPS on Railway, which the browser requires for this.
- After OAuth the API redirects the browser to `WEB_ORIGIN`.

## CLI alternative

```bash
npm i -g @railway/cli && railway login
railway link                      # select the project
# API service:
railway service                   # select amabo-api
railway variables set NODE_ENV=production BASE_URL=https://<api> WEB_ORIGIN=https://<web>
railway up
# web service:
railway service                   # select amabo-web
railway variables set VITE_API_BASE=https://<api>
railway up
```

## Single-service alternative

If you'd rather run **one** service (API also serves the PWA from the same origin),
build both and set `WEB_DIST=apps/web/dist` (or just leave the build to produce it) — the
API auto-serves it and you can drop `WEB_ORIGIN`/`VITE_API_BASE`/CORS entirely. (Earlier
commits used this; we switched to two services per `ARCHITECTURE.md` §16.)

## Notes

- Lazy simulate-on-read needs **no always-on worker** — these two services + Postgres
  cover v1. An eager `CronScheduler` would be a separate Railway cron later.
- `packages/chain` (optional crypto, M10) is absent and not part of this deploy.

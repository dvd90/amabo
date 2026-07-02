# Deploying Amabo on Railway (two services)

Amabo deploys as **two Railway services from this one repo** — a Node **API** and a
static **web** PWA — plus a managed **Postgres**. They run on different origins, so the
API is configured for credentialed CORS + `SameSite=None` cookies (handled for you via
env vars below).

```
Railway project "amabo"
├── Postgres            (managed plugin → injects DATABASE_URL)
├── amabo-api           (Root Directory: apps/api  →  apps/api/railway.json)
└── amabo-web           (Root Directory: apps/web  →  apps/web/railway.json)
```

Each service has its own `railway.json` inside its app directory. Set **Root Directory**
(not Config Path) per service so Railpack auto-discovers the config.

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
2. **Source → Root Directory:** set to `apps/api` (this is how Railpack finds `apps/api/railway.json`).
3. **Settings → Networking → Generate Domain** (note the URL, e.g. `https://amabo-api.up.railway.app`).
4. **Variables** → add:

   | Variable               | Required   | Value / notes                                                                                          |
   | ---------------------- | ---------- | ------------------------------------------------------------------------------------------------------ |
   | `NODE_ENV`             | ✅         | `production` — enables Secure cookies, trust-proxy, and `SameSite=None`                                |
   | `DATABASE_URL`         | ✅         | `${{ Postgres.DATABASE_URL }}` (reference the Postgres service)                                        |
   | `BASE_URL`             | ✅         | the **API's own** URL, e.g. `https://amabo-api.up.railway.app` (OAuth redirect + share links)          |
   | `WEB_ORIGIN`           | ✅         | the **web app's** URL, e.g. `https://amabo-web.up.railway.app` (CORS allow-list + post-login redirect) |
   | `ANTHROPIC_API_KEY`    | optional   | omit → local templated narrator (zero AI cost)                                                         |
   | `GOOGLE_CLIENT_ID`     | optional\* | Google OAuth client ID (alias: `GOOGLE_OAUTH_ID`)                                                      |
   | `GOOGLE_CLIENT_SECRET` | optional\* | Google OAuth client secret (alias: `GOOGLE_OAUTH_SECRET`)                                              |
   | `GOOGLE_CALLBACK_URL`  | optional   | Pin the exact redirect URI, e.g. `https://<api-url>/auth/google/callback`. Must match the console.     |

   \*Passwordless **email sign-in is always available** and needs no setup — it's the
   primary login. The Google vars are optional and only enable the "Continue with
   Google" button; without them that button falls back to a fake provider (local/testing
   only), but email login still works in production.

   > Chicken/egg: you need the web URL for `WEB_ORIGIN`. Either create the web service
   > first to get its domain (Step 3), or set a placeholder now and update `WEB_ORIGIN`
   > after Step 3, then redeploy the API.

5. Deploy. Railpack builds from the monorepo root, the **release step** runs `drizzle-kit migrate`,
   then starts `node dist/index.js`. Check `GET https://<api-url>/health` → `{ "ok": true }`.

## Step 3 — Add the **web** service (`amabo-web`)

1. Project → **New → GitHub Repo** → same repo `dvd90/amabo` (branch `main`).
2. The new service → **Settings → Source → Root Directory:** `apps/web`.
3. **Settings → Networking → Generate Domain** (e.g. `https://amabo-web.up.railway.app`).
4. **Variables** → add (note: this is a **build-time** var — Vite inlines it):

   | Variable        | Required | Value / notes                                              |
   | --------------- | -------- | ---------------------------------------------------------- |
   | `VITE_API_BASE` | ✅       | the **API's** URL, e.g. `https://amabo-api.up.railway.app` |

5. Deploy. Railway builds the PWA (`vite build`) and serves `dist/` via `serve -s` on `$PORT`.

## Step 4 — Wire the cross-links

1. Back on **amabo-api** → confirm `WEB_ORIGIN` = the web service URL (Step 3.3). Redeploy if you changed it.
2. **Google OAuth** (optional — email sign-in works with no setup): in Google Cloud
   Console → your OAuth client → **Authorized redirect URIs**, add the URI the API will
   send. If you set `GOOGLE_CALLBACK_URL`, register **exactly** that (e.g.
   `https://<api-url>/auth/google/callback`); otherwise register
   `https://<api-url>/auth/callback` (the API derives this from the request host, so a
   wrong `BASE_URL` no longer causes `redirect_uri_mismatch`). The callback is served at
   **both** `/auth/callback` and `/auth/google/callback`, so either choice works.

## Step 5 — Verify

- `https://<web-url>/` → the threshold loads (email field + "Continue with Google").
- **Email:** type any email → you land on the **dashboard** (your roster of amabos).
- **Google** (if configured): sign in → back on the web app, signed in (`/me` works
  cross-origin).
- Dashboard → "New amabo" condenses a Mote → opens the device. "◂ all" returns to the
  roster; "Sign out" ends the session.
- Create a creature, peek, care — all calls go to the API with the session cookie.

### Verify a deploy (which build is actually live?)

Every deploy is stamped with the commit it was built from (LAUNCH_PLAN.md L0):

```bash
curl -s https://<api-url>/health          # → { ok, version: "<git sha>", startedAt }
git rev-parse origin/main                 # must match `version`
```

If they differ, the API service is running a stale build — check Railway →
`amabo-api` → **Deployments** for a failed build and redeploy. The web bundle
carries its own stamp: **Settings → “build abc1234”** at the bottom of the sheet.
If the web stamp lags after a deploy, it's the PWA cache — reload twice or
reinstall the app. Locally both stamps read `dev`.

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
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_CALLBACK_URL=https://amabo-api.up.railway.app/auth/google/callback
# optional — push notifications (see "Notifications" below):
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:you@example.com
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

## Notifications (optional — PWA web-push)

A care game lives on the ping. Push is off until you set it up:

1. **Generate VAPID keys once** (locally): `npx web-push generate-vapid-keys`.
2. On **amabo-api**, set `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT`
   (`mailto:you@example.com`). The API serves the public key at `GET /push/vapid`, so the
   web app does **not** need a separate VAPID env var.
3. Add a **Railway Cron** that runs the scheduler on the API image, e.g. every 30 min:
   - Schedule: `*/30 * * * *`
   - Command: `node dist/cron/notify.js`
     It catches each subscribed Light's creatures up to now and pings the most urgent one
     (illness, souring, low Ambra, ready-to-ascend, overflowing, or a long absence), at most
     once per ~6h per device. Dead subscriptions are pruned automatically.
4. In the app, tap **🔔 Notify me** on the dashboard, accept the browser prompt, and you're
   subscribed. (iOS requires the PWA to be **installed** to Home Screen first.)

## Notes

- Lazy simulate-on-read needs **no always-on worker** — these two services + Postgres
  cover v1; notifications add a single periodic **cron** (above), still no worker.
- `packages/chain` (optional crypto, M10) is absent and not part of this deploy.

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

   | Variable                   | Required   | Value / notes                                                                                             |
   | -------------------------- | ---------- | --------------------------------------------------------------------------------------------------------- |
   | `NODE_ENV`                 | ✅         | `production` — enables Secure cookies, trust-proxy, and `SameSite=None`                                   |
   | `DATABASE_URL`             | ✅         | `${{ Postgres.DATABASE_URL }}` (reference the Postgres service)                                           |
   | `BASE_URL`                 | ✅         | the **API's own** URL, e.g. `https://amabo-api.up.railway.app` (OAuth redirect + share links)             |
   | `WEB_ORIGIN`               | ✅         | the **web app's** URL, e.g. `https://amabo-web.up.railway.app` (CORS allow-list + post-login redirect)    |
   | `LLAMA_API_KEY`            | optional   | narration via Llama 3.3 70B (the current pick). Key is from the HOST (default: Groq — console.groq.com)   |
   | `LLAMA_BASE_URL`           | optional   | the host's OpenAI-compatible root (default `https://api.groq.com/openai/v1`; Together/DeepInfra work too) |
   | `LLAMA_MODEL`              | optional   | model id at the host (default `llama-3.3-70b-versatile` on Groq — verify at the host's docs)              |
   | `XAI_API_KEY`              | optional   | narration via xAI's Grok. Metered exactly like the others (L3)                                            |
   | `XAI_MODEL_PEEK`           | optional   | Grok model for routine peeks (default `grok-4-1-fast-non-reasoning` — verify at docs.x.ai)                |
   | `XAI_MODEL_MILESTONE`      | optional   | Grok model for milestones (default `grok-4-1-fast-reasoning`)                                             |
   | `NARRATOR_PROVIDER`        | optional   | `llama`, `grok`, or `anthropic` — picks when several keys are set (default order: llama → grok → claude)  |
   | `ANTHROPIC_API_KEY`        | optional   | narration via Anthropic's Claude. Either key alone works; neither → local templated narrator              |
   | `NARRATION_USER_ALLOWANCE` | optional   | model-narrated peeks per Light per rolling day (default 10); over it → local voice                        |
   | `NARRATION_DAILY_CAP`      | optional   | global model calls per rolling day (default 2000) — the no-surprise-bill breaker                          |
   | `SENTRY_DSN`               | optional   | error monitoring (L1); omit → silent no-op                                                                |
   | `LOG_LEVEL`                | optional   | `debug` \| `info` (default) \| `warn` \| `error` \| `silent` — how chatty the server log is               |
   | `LOG_FORMAT`               | optional   | `json` for one-object-per-line structured logs; default is human-readable lines                           |
   | `AMABO_FEATURE_CHAIN`      | optional   | `1` turns on the Sky (ARCHITECTURE.md §13): `POST /stars/:id/inscribe`. Off = the route does not exist    |
   | `STAR_SIGNER_KEY`          | optional\* | dedicated hot key (0x + 64 hex) whose address is StarNFT's `signer`; never the deployer/treasury key      |
   | `STAR_CONTRACT`            | optional\* | the StarNFT clone address (`star` in `packages/robinhood-contracts/deployments/4663.json`)                |
   | `STAR_CHAIN_ID`            | optional   | default `4663` (Robinhood Chain). `STAR_NAME` (default `Star`) must equal the contract's name             |
   | `STRIPE_SECRET_KEY`        | optional   | the till (L5). All three Stripe vars set → the Keeper's Lantern sells; any missing → free mode            |
   | `STRIPE_PRICE_LANTERN`     | optional   | the Lantern's subscription price id (`price_…`, ~$3.99/mo)                                                |
   | `STRIPE_WEBHOOK_SECRET`    | optional   | signing secret of a webhook endpoint pointed at `https://<api-url>/billing/webhook`                       |
   | `GOOGLE_CLIENT_ID`         | optional\* | Google OAuth client ID (alias: `GOOGLE_OAUTH_ID`)                                                         |
   | `GOOGLE_CLIENT_SECRET`     | optional\* | Google OAuth client secret (alias: `GOOGLE_OAUTH_SECRET`)                                                 |
   | `GOOGLE_CALLBACK_URL`      | optional   | Pin the exact redirect URI, e.g. `https://<api-url>/auth/google/callback`. Must match the console.        |

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

### The Keeper's Key (unlock your own account)

`users.unlocked` is a DB-only flag — no API route can set it — that opens everything
for one account: no shelf cap, no daily narration allowance, and the UI presents as a
lit Lantern (no upsells). Meant for the owner and testers. In Railway → Postgres →
**Data/Query**:

```sql
UPDATE users SET unlocked = true WHERE email = 'dvdsellam@gmail.com';
-- and to hand it back:
UPDATE users SET unlocked = false WHERE email = '...';
```

It takes effect on the next request (no re-login needed). The global narration
breaker (`NARRATION_DAILY_CAP`) still applies — that one protects the bill, not a
feature.

### The heartbeat cron (push + the Chronicle writing itself)

One scheduled job makes the world act while everyone is away: it catches every
subscribed Light's creatures up, **extends their Chronicle** (creatures meet, pages
get written — gap-gated and breaker-shared, so it cannot run up the model bill),
and sends web-push pings — urgent needs first, else fresh shelf news ("Vel & Mo met
while you were away").

1. Generate VAPID keys once: `npx web-push generate-vapid-keys`. On **amabo-api**
   set `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` (+ optional
   `VAPID_SUBJECT=mailto:you@example.com`) so devices can subscribe.
2. Railway → your project → **Create → GitHub Repo** → `dvd90/amabo` again. In the
   new service's **Settings**:
   - **Source → Root Directory**: leave **EMPTY** (the repo root — that's where
     pnpm is declared, and the config uses full paths)
   - **Config-as-code / Config Path**: `railway.cron.json`
   - leave Custom Build/Start Commands and the UI Cron Schedule **empty** — UI
     values silently override the file.

   Then in its **Variables**: `DATABASE_URL` (reference the Postgres), the three
   VAPID vars, and your LLM key (`LLAMA_API_KEY`) so cron-written pages are
   model-voiced.

3. Each run logs `[notify] run complete pinged=N` and exits — it costs seconds of
   compute per run. Without this service the world still works (lazy
   simulate-on-read); you just lose pushes and unwatched Chronicle pages.

### Read the server log (where things fail, out loud)

Railway → `amabo-api` → **Deployments** → click the **Active** deployment →
**Deploy Logs** (Build Logs is only the install/build phase). Every line is
structured: `<timestamp> LEVEL [scope] message key=value…`. At boot you should see
`[boot]`/`[narration]` lines naming the repository, the narration provider, Sentry,
and the till; after boot the log stays quiet except **failures** — LLM fallbacks
(`[narration:model]`), meter trips (`[narration:meter]`), auth failures (`[auth]`),
Stripe webhook rejections (`[billing]`), client error beats (`[telemetry]`), and
unhandled 500s (`[http]`, with stack). `LOG_LEVEL=debug` adds per-Light allowance
refusals; `LOG_FORMAT=json` makes each line machine-parseable.

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

## The Sky — `www.theamarium.com` (optional, ARCHITECTURE.md §13)

The chain layer is off until you turn it on, and it is three pieces: the contracts, the
API's voucher, and the Sky site. In order:

1. **Contracts** — `packages/robinhood-contracts`: `forge script script/Deploy.s.sol
--rpc-url robinhood --broadcast` (env `STAR_SIGNER` = the address of the API's hot
   key; `STAR_SEAT_PRICE`, `STAR_MAX_SEATS`, `STAR_INSCRIBE_PRICE`, `STAR_BASE_URI` =
   `https://www.theamarium.com/sky/`). Writes `deployments/4663.json` (`star`). Confirm
   every `// VERIFY` address first.
2. **API** (`amabo-api`) — `AMABO_FEATURE_CHAIN=1`, `STAR_SIGNER_KEY`, `STAR_CONTRACT`
   (see the table above). `/health` unaffected; the boot log says "the Sky is on".
3. **Device** (`amabo-web`) — `VITE_SKY_URL=https://www.theamarium.com` at build time.
   Without it the device shows no link to the Sky and refuses the `/inscribe` handoff.
4. **The Sky** — a third Railway service from the same repo, **Root Directory
   `apps/robinhood-web`** (Next 15; build `next build`, start `next start`), custom
   domain `www.theamarium.com`, variables:

   | Variable                             | Purpose                                                                      |
   | ------------------------------------ | ---------------------------------------------------------------------------- |
   | `NEXT_PUBLIC_API_BASE`               | the API's public origin (single-origin deploy: `https://app.theamarium.com`) |
   | `NEXT_PUBLIC_APP_URL`                | the device (`https://app.theamarium.com`) — where the glass vouches          |
   | `NEXT_PUBLIC_ROBINHOOD_RPC_URL`      | Robinhood Chain RPC (VERIFY against official docs)                           |
   | `NEXT_PUBLIC_ROBINHOOD_EXPLORER_URL` | Blockscout URL (VERIFY)                                                      |

   The Sky never sees a game session: it reads `GET /sky/stars/:id` (public, CORS `*`)
   and otherwise talks only to the chain through the visitor's wallet.

## Notes

- Lazy simulate-on-read needs **no always-on worker** — these two services + Postgres
  cover v1; notifications add a single periodic **cron** (above), still no worker.
- The Sky (`packages/robinhood-contracts` + `apps/robinhood-web`, `www.theamarium.com`,
  M10) deploys separately and is not part of this deploy; `app.theamarium.com` is the
  web service above.

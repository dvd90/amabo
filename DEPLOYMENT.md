# Deploying Amabo on Railway

This repo deploys as **one Railway service** that serves **both the API (back) and the
PWA (front)** from a single origin, plus a managed **Postgres**. Single-origin keeps
auth/cookies/CSRF simple (no cross-site config). See `ARCHITECTURE.md` §16.

`railway.json` (repo root) already encodes the build, the release-step migration, the
start command, and the `/health` healthcheck — so Railway needs almost no config.

## One-time setup

1. **Create the project & connect the repo**
   - Railway → **New Project → Deploy from GitHub repo** → pick `dvd90/amabo`, branch `main`.
   - Railway reads `railway.json` automatically.

2. **Add Postgres**
   - In the project: **New → Database → Add PostgreSQL**.
   - It injects **`DATABASE_URL`** into the service automatically (reference it if needed
     via `${{ Postgres.DATABASE_URL }}`).

3. **Set environment variables** on the service (Variables tab):

   | Variable | Required | Notes |
   |----------|----------|-------|
   | `NODE_ENV` | ✅ | `production` (enables Secure cookies + trust-proxy) |
   | `DATABASE_URL` | ✅ | from the Postgres plugin |
   | `BASE_URL` | ✅ | your public URL, e.g. `https://amabo.up.railway.app` (used for OAuth redirect + share links) |
   | `ANTHROPIC_API_KEY` | optional | omit → local templated narrator (no AI cost) |
   | `GOOGLE_OAUTH_ID` / `GOOGLE_OAUTH_SECRET` | optional | omit → fake auth provider (DO NOT use in prod) |

   > For real sign-in, create a Google OAuth client and add
   > `${BASE_URL}/auth/callback` as an authorized redirect URI.

4. **Deploy.** On `git push` to `main`, Railway:
   - builds with pnpm: `pnpm build && pnpm --filter @amabo/web build`
   - runs the **release step**: `pnpm --filter @amabo/api db:migrate` (drizzle-kit)
   - starts: `pnpm --filter @amabo/api start` → the API serves the PWA at `/`

   Health: `GET /health` → `{ "ok": true }`.

## What's served where (single service)
- `GET /` and any client route → the PWA (`apps/web/dist`, SPA fallback)
- `GET /assets/*` → built static assets
- `/health`, `/me`, `/auth/*`, `/creatures/*`, `/visit/*`, `/postcard/*`, `/share/*`,
  `/meet`, `/rehome/*`, `/report`, `/block` → the API

The API auto-detects the built web at `apps/web/dist` (override with `WEB_DIST`). If the
web isn't built, it runs **API-only** — handy for a separate-static-host setup.

## CLI alternative
```bash
npm i -g @railway/cli
railway login
railway init           # or: railway link  (existing project)
railway add --database postgres
railway variables set NODE_ENV=production BASE_URL=https://<your-app>.up.railway.app
railway up             # build + deploy from the current commit
```

## Notes
- The lazy simulate-on-read model needs **no always-on worker** — one web service +
  Postgres covers v1. The eager `CronScheduler` would be a separate Railway cron later.
- `packages/chain` (optional crypto, M10) is absent and not part of this deploy.

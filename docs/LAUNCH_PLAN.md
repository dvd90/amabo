# LAUNCH_PLAN.md — from playable to sellable

> The road from "it runs on main" to "it earns". Pairs with `IMPLEMENTATION_PLAN.md`
> (which built the game) — this plan builds the *business around* the game. Same rules
> apply: TDD on everything with logic in it, the two laws never break, and **the till
> never touches the soul** — souring, illness, death, and redemption are never gated,
> metered, or sold. One milestone ≈ one PR; do them in order; each unblocks the next.
>
> Grounding (audited 2026-07): scarcity rules exist in the engine but `/health` can't
> prove what's deployed; AI narration falls back to the local templated narrator (no
> key, no metering); there is no payment code, no entitlements, no Terms/Privacy, no
> age gate, no error monitoring, no funnel analytics; creature slots are unlimited;
> the push cron isn't scheduled. That is the whole gap — nothing else blocks revenue.

## The one-line strategy

Sell the **inner life**. The care loop is the hook and stays free; the thing worth
paying for is a creature that genuinely *writes* — more voice, more room on the
shelf, and keepsakes of a life witnessed. Subscription first (predictable, fits a
daily ritual), one-time keepsakes second, nothing else until data says so.

## L0 — See what's live (deploy truth) · ~½ day

The immediate itch: refusals shipped in the engine but the live app may be stale,
and today nothing can prove it either way.

- [ ] `/health` returns `{ ok, version, builtAt }` — version from
      `RAILWAY_GIT_COMMIT_SHA` (fallback `process.env.AMABO_VERSION`, then `"dev"`).
- [ ] The web app bakes its own stamp (`import.meta.env` define at build) and shows
      it small in Settings — stale-PWA confusion dies here too.
- [ ] `DEPLOYMENT.md` gains a "verify a deploy" section: `curl /health`, compare to
      `git rev-parse origin/main`.
- [ ] Manual (owner): open Railway, confirm both services' latest deploys succeed and
      postdate PR #66; re-trigger if not.

**Done when:** `curl <api>/health` shows the current main SHA, and feeding a full
creature on the live site is refused.

## L1 — Eyes and ears (ops) · ~1 day

You cannot run a paid service blind.

- [ ] **Errors:** Sentry in both apps (Express error handler + web error boundary),
      DSN via env, a silent no-op when unset. Alert on first-error-of-a-kind.
- [ ] **Funnel:** an owner-run `events` table in our own Postgres (no third party,
      no cookies): `POST /telemetry` (rate-limited, anonymous id + optional user id),
      client batches. Events: `visit`, `birth_seen`, `signup`, `creature_created`,
      `care_action`, `peek`, `push_enabled`, `return_day`.
- [ ] A `docs/FUNNEL.sql` with the queries that matter: signup rate, D1/D7 retention,
      actions per session. These numbers decide pricing later — collect them now.

**Done when:** a thrown test error appears in Sentry; the D1 query returns a number.

## L2 — Lawful (trust, safety, the age gate) · ~1 day

Blocking for taking money, and for running AI over strangers' pets. Virtual pets
skew young: position the product **13+** and mean it.

- [ ] `/terms` and `/privacy` pages — plain-language, honest (what we store, that an
      AI writes the creature's diary, no ads, no selling data), linked from the login
      screen and Settings.
- [ ] Age gate at signup: a required "I'm 13 or older" confirmation; wire the dead
      `ageBand` field (`13-17` / `18+`); under-13 is refused kindly (COPPA).
- [ ] Account deletion: owner-scoped cascade (creatures, journals, bonds, letters,
      shares, push subs, events) behind a double-confirm in Settings. Export-as-JSON
      is a fast follow, not a blocker.

**Done when:** signup is impossible without the age confirmation, and deleting an
account leaves zero owner-scoped rows (tested).

## L3 — Turn the soul on (AI narration, metered) · ~2 days

The demo→product flip. The differentiator is currently switched off.

- [ ] Set `ANTHROPIC_API_KEY` on Railway (manual, owner).
- [ ] **Per-user meter:** narrated peeks/day counted in Postgres; over the allowance
      the narrator falls back to local templates *silently and gracefully* (the
      creature never goes mute). Allowance in config: free `10/day` (tune later).
- [ ] **Global breaker:** a daily model-call budget (config); tripping it degrades
      everyone to the local narrator and raises a Sentry alert. No surprise bills.
- [ ] **Cost ledger:** tokens per call into the `events` table; one `FUNNEL.sql`
      query = cost per user per day. (Haiku peeks + prompt caching ≈ pennies; the
      ledger proves it.)
- [ ] Existing tiering stands: `claude-haiku-4-5` for peeks, `claude-sonnet-4-6` for
      milestones; structured output via `record_life`; AI output stays zod-validated
      and never trusted (the second law).

**Done when:** a live peek reads like `STORY.md` §9 (vibe loop, human-judged); the
11th peek of the day is templated without an error; the breaker trips in a test.

## L4 — The shelf (felt scarcity, still 100% free) · ~1–2 days

Refusal thresholds stop exploits but don't *feel* like an economy. Add the one cap
that matters and make the existing costs visible. No paywall yet — this milestone
just creates the shape a subscription will later widen.

- [ ] **Slots:** `FREE_SLOTS = 3` *active* creatures (config, engine-adjacent but
      enforced in the API — the engine stays pure). The 4th condense is refused
      kindly: "your shelf holds three; a wider shelf, one day ✦". Archived and
      ascended lights never count against it.
- [ ] **Visible costs:** energy rendered as the currency it already is (play costs
      it, sleep restores it); refusals get louder (the shake + a clear line), so
      over-care reads as the creature's will, not a bug.
- [ ] Resist adding more scarcity (timers, consumables, daily gifts) until L6 data
      exists. The lore is "care, not grind" — protect that.

**Done when:** the 4th condense on a free account returns 403 with the lore line
(tested, owner-scoped), and a refused feed is unmissable on the device.

## L5 — The till (entitlements + Stripe) · ~3–4 days

- [ ] **Entitlements first, payments second:** `users.entitlements` jsonb —
      `{ tier: 'free' | 'lantern', renewsAt }` — resolved through a shared zod
      schema; every gate reads the tier, nothing reads Stripe directly.
- [ ] **The Keeper's Lantern** (~$3.99/mo, Stripe Checkout subscription):
      slots 3 → 8 · narration meter 10 → 100/day · milestone narration on Sonnet ·
      full theme set + pixel skin (base theme stays free) · priority in future
      features. Letters, meetings, the Symposium, and all endings stay free.
- [ ] Stripe webhook (`checkout.session.completed`, `customer.subscription.updated`,
      `…deleted`) → set/clear tier; idempotent; signature-verified; a `stripe_events`
      table for replay safety. Customer-portal link in Settings for cancel/receipts.
- [ ] **The guard test:** an acceptance test asserting no entitlement check exists in
      any souring/illness/death/redemption path — the rule made executable.
- [ ] **Keepsake (fast follow):** the graduation star certificate — a rendered,
      shareable image of the named star with its epitaph — as a one-time price
      (~$2.99). It is also free marketing every time it's shared.

**Done when:** a test-mode checkout upgrades an account and widens the shelf; cancel
downgrades at period end; the guard test is green; webhooks are idempotent (tested).

## L6 — Open the doors (soft launch) · ongoing

- [ ] Schedule the push-notify cron on Railway (manual, owner) — the retention lever.
- [ ] Custom domain; PWA install nudge after the first graduation or multiply.
- [ ] Soft launch to 20–50 people (friends, one Discord, r/virtualpets), watch a week
      of `FUNNEL.sql`: signup rate, D1/D7, narration attach, refusal rates.
- [ ] **Gates before spending anything on acquisition:** D7 ≥ ~15% and narration
      attach ≥ ~40%. Below that, iterate the loop (L4 tuning), not the marketing.
- [ ] Price test only after retention holds. Product Hunt / a launch post when the
      numbers say the funnel converts.

## Risks, named

- **COPPA / young audience** — hold the 13+ line (L2); no ads ever; revisit a true
  kids' mode only with real legal advice.
- **AI cost blowout** — L3's meter + breaker + ledger exist before the key does.
- **App stores** — stay PWA + web billing (no 30% cut); Expo wrapper only if the web
  funnel proves out, and keepsakes may need IAP there.
- **Solo operator** — support = a `mailto:` in Settings + Sentry alerts; keep the
  no-worker lazy architecture (nothing to babysit at 3am).
- **Selling the project itself** (the other meaning of "sell it") — the same plan
  applies: an acquirer pays for L1's retention numbers and L5's revenue switch far
  more than for features.

## Order and effort

```
L0 deploy truth      ~½ day   ← do first; answers "is scarcity live?" forever
L1 eyes and ears     ~1 day
L2 lawful            ~1 day   ← L0–L2 ship together in days: the hygiene wall
L3 soul on           ~2 days  ← the product becomes the pitch
L4 the shelf         ~1–2 days
L5 the till          ~3–4 days
L6 doors open        ongoing  ← ~2 focused weeks from here to first dollar
```

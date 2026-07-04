# Amabo / the Amarium

A Tamagotchi-style pocket device holding one creature that lives on its own clock
inside a sealed glass world, **the Amarium**. You are _the Light_: your attention is
the warmth it grows by, into a radiant **Amabo** or an uncanny, longing **Yim**.

> Start with `CLAUDE.md`, then read `docs/STORY.md` → `docs/ARCHITECTURE.md` →
> `docs/IMPLEMENTATION_PLAN.md`. STORY.md is the soul: the myth _is_ the spec.
> Ops & deploy live in `DEPLOYMENT.md`; the launch runway in `docs/LAUNCH_PLAN.md`.

## The two laws

1. **The engine owns all logic.** `packages/engine` is pure — no I/O, no `Date.now()`,
   no `Math.random()` (time and randomness are injected). It decides _what_ happens.
2. **The AI owns only flavor.** `packages/ai` turns engine state into the creature's
   voice (STORY.md §9). It never mutates state and is never trusted (zod at every
   boundary; a local templated voice stands in on any failure — the device never
   shows an error).

Plus the launch-phase law: **the till never touches the soul** — souring, illness,
death, and redemption are never gated, metered, or sold (enforced by
`soul-guard.test.ts`).

## The game, in one sitting — mechanics TLDR

### A life in the glass

- **Birth.** You condense a **Mote** from gathered ambra and name it. A logged-out
  visitor meets an ephemeral newborn first (`/demo/birth`) — the hook before signup.
- **Identity, dealt once at birth (no two alike).**
  - **Soulmark** (§8½): essence ("I am…"), temperament, loves, fears, a quirk —
    seeded-unique, then elaborated by the LLM; every journal is written through it.
  - **Temper** (§8⅞): seeded leanings (boldness, warmth, jealousy, curiosity,
    sociability) that tilt its social life and nothing else.
- **Stats** (all 0–100): `ambra` (inner love-light — decays fastest in the dark),
  energy, cleanliness, health, affection, `security` ("okay alone in the dark").
- **Care** — feed / clean / play / comfort. Over-care is **refused** and costs
  affection, so care can't be spammed: the game paces itself by real need. The
  dashboard shows urgency pips per creature.
- **Sleep** serves the creature, not the clock: it collapses when exhausted, turns in
  early at night, wakes when rested.
- **Illness** grows from sustained low cleanliness, drains health, and mends once
  clean again.
- **Disposition** (−100…+100) is the moral engine: care that lands drifts it toward
  radiant **Amabo** (+); neglect and refusals sour it toward **Yim** (−, uncanny
  presentation below −30). **Comfort is the redemption lever** — a Yim is always
  lovable back toward the light; warm company at a gathering is the second way back.
- **Stages** — `mote → spark → velveteen → bloom`, gated by age **and** total care:
  a creature becomes Real by being loved a long time, not by the clock.
- **Multiply** — a settled creature (velveteen+) overflowing with ambra (95+) splits,
  Symposium-style; the child is a new unique soul.
- **Graduation** — a radiant, secure, settled Bloom becomes too bright for the glass
  and ascends: a ceremony, then a **named star** in your permanent constellation.
- **Lethe (death, soft and slow)** — only two uninterrupted weeks of deep neglect
  with a fully soured heart lets a light go out, unremembered. Any landed act of
  care resets the count. Endings get a **farewell ceremony** and leave the shelf
  (archive); ascended ones remain as their stars.

### The magic beat: away → return

- **Lazy simulate-on-read**: nothing runs while you're away; on any read the engine
  replays the gap deterministically (seeded RNG, frame-rate independent).
- **Peek** → the AI writes the creature's diary of the gap (its mood, its memories),
  plus a factual **"while you were away"** recap (what changed, highlights).
- **Daypaths** (§8¾): after 4h+ away, the engine deals 3 mechanically-equal ways it
  might have spent the stretch; the AI **chooses one in character** — the dealer's
  law: _the glass deals the cards; the soul only picks one_. The chosen day enters
  the journal ("I built a small thing to show you — I picked that, myself").
- **Manner**: the same call sets how it currently keeps its world — a haunt, a
  ritual, an obsession, a gait — shown under the soulmark on the status screen.
- **Memories** are LLM-distilled one-liners with salience; only the top-N ride in
  any prompt, so prompts stay flat as a creature ages.
- **Push notifications** (PWA): a Railway cron catches everyone up and pings when a
  creature genuinely needs its Light (per-device cooldown; dead endpoints pruned).

### Company: the social layer

- **Introduce two** — a picker ceremony with a truthful compatibility reading, a
  spoken **duet scene**, harmony vs. gentle clash (a duet, never a duel; small
  symmetric nudges, nothing damaged), a thread in the sky, per-pair cooldown.
- **The Symposium** — gatherings in the glade (2–9 creatures, optionally a guest
  from another Light): the engine outlines who harmonised, mentor moments (an elder
  telling a Mote how a made thing becomes Real), ambra passed hand to hand, a Yim
  **warmed** by company; the AI voices the transcript; newly bonded pairs exchange
  **letters** (the pen-pal thread).
- **The friendship sky** — every bond is a persistent thread between stars; meetings
  and gatherings thicken it.
- **The Chronicle** (§8⅞) — the shelf writes its own book: while you're away, the
  engine may bring pairs together (tempers + hearts' distance decide **warm** vs
  **strained** — small frictions, never harm: envy that is really longing). The AI
  writes each scene plus a living one-line **standing** per pair ("Fond, but keeping
  score."). Encounters move bonds and story only — never stats.
- **Between Lights** — scoped, revocable, expiring share links: **visits** (another
  Light shining in gently warms the creature), read-only **postcards**,
  cross-owner meetings and gatherings, and **rehoming** (double-confirmed, audited).
  Report/block exist; cross-owner reads 404, never 403.

### Accounts, money, ops

- **Auth**: passwordless email magic-link (primary) + Google OAuth; httpOnly
  sessions, CSRF on all mutations, every query owner-scoped. 13+ **age gate** before
  the first creature; full **account deletion** cascade. Appearance prefs (theme,
  pixel/smooth) live on the account.
- **The shelf & the till**: 3 free active slots; the **Keeper's Lantern**
  (Stripe subscription) widens the shelf to 8 and the daily model-voiced allowance
  from 10 to 100. Stripe webhook is signature-verified, idempotent, and the sole
  writer of entitlements. No Stripe vars → the game is simply free.
  (`users.unlocked` — the Keeper's Key — is a DB-only flag that opens everything
  for one account; no API can set it.)
- **The AI layer**: provider-pluggable behind one structural port — Llama 3.3 70B on
  Groq (default), xAI Grok, or Anthropic Claude; first key found wins
  (`LLAMA_API_KEY` / `XAI_API_KEY` / `ANTHROPIC_API_KEY`). Model ids self-heal
  against the host's live `/models` list. Two tiers (cheap peeks / finer
  milestones). Spend is fenced three ways: per-Light daily allowance → global daily
  breaker → cost ledger in Postgres (`telemetry`, `docs/FUNNEL.sql` turns it into
  cost-per-user-per-day). Everything degrades to the local voice, never an error.
- **Ops**: structured logger (`LOG_LEVEL`, `LOG_FORMAT=json`; every failure names
  itself, scoped `[auth]/[narration]/[billing]/[chronicle]/…`), dependency-free
  Sentry monitor (`SENTRY_DSN`), version-stamped `/health` (deploy truth = git SHA),
  own-Postgres product funnel, Terms/Privacy pages. Deploy: Railway (API + managed
  Postgres + static web), migrations on release, no always-on worker.

## Layout

```
amabo/
├── apps/  web/ (the device, PWA) · api/ (Express + engine host)
└── packages/  engine/ (pure core ★) · ai/ (narration) · shared/ (zod + lore consts)
```

## Commands

```bash
pnpm install
pnpm test                              # vitest across packages
pnpm --filter engine test --coverage   # keep the core ~100%
pnpm typecheck                         # tsc project references
pnpm lint                              # eslint (enforces engine purity)
pnpm format                            # prettier --write
pnpm --filter api dev                  # :3000
pnpm --filter web dev                  # :5173
```

Stack: TypeScript · Express · PostgreSQL via Drizzle · Vite + React PWA · Vitest ·
deploy on Railway. Status: **game milestones M0–M-K and launch runway L0–L5 built**;
current phase is soft launch (`docs/LAUNCH_PLAN.md` L6).

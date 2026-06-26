# CLAUDE.md — Amabo / the Amarium

> Agent operating manual. Read this first, then the three docs it points to. This file
> is intentionally short: it tells you *how to work here*; the docs hold the detail.

## What we're building

**Amabo** is a Tamagotchi-style pocket device holding one creature that lives on its
own clock inside a sealed glass world, **the Amarium**. You don't control the
creature — you care for it (you are *the Light*), and it grows into someone based on
how it's treated: a radiant **Amabo** or an uncanny, longing **Yim**. The magic beat
is opening the device after hours away and reading what it did and felt while you were
gone. Classic care loop on the surface; a real, literary, AI-written inner life
underneath.

## Read these in order

1. **`docs/STORY.md`** — the lore bible and **the soul of the project**. The myth *is*
   the spec: every legend maps to a mechanic, and §9 is the voice the AI must write
   in. **Read it before writing any code.**
2. **`docs/ARCHITECTURE.md`** — how the myth becomes a buildable system (monorepo,
   pure engine, AI layer, lazy simulate-on-read, data model, API, device).
3. **`docs/IMPLEMENTATION_PLAN.md`** — the build order and the **TDD feedback loop**
   you run on every task.

## The two laws (never break these)

1. **The engine owns all logic.** `packages/engine` is pure (no I/O, no `Date.now()`,
   no `Math.random()` — time and randomness are injected) and decides *what* happens.
2. **The AI owns only flavor.** `packages/ai` turns engine state into the creature's
   voice (per `STORY.md` §9). It never mutates state and is never trusted.

## How to work a task (the loop)

`READ → RED → GREEN → RUN → REFACTOR → REVIEW → DOC → COMMIT`
(full definition in `IMPLEMENTATION_PLAN.md` §1). TDD is mandatory; the failing test
comes first and lives in the same commit as the implementation.

## Repo map

```
amabo/
├── CLAUDE.md                  ← you are here
├── docs/  STORY.md · ARCHITECTURE.md · IMPLEMENTATION_PLAN.md
├── apps/  web/ (device) · api/ (express + engine host)
└── packages/  engine/ (pure core ★) · ai/ (narration) · shared/ (zod + lore consts)
```

## Conventions

- Lore terms are the source of truth: `ambra`, `disposition` (Amabo +/Yim −),
  stages `mote→spark→velveteen→bloom`, `elysium`/`stars`. Use them exactly.
- Validate every boundary (API in/out, AI output) with shared **zod** schemas.
- Tunables live in `packages/engine/config.ts`; no magic numbers inline.
- Model tiering: `claude-haiku-4-5` for routine peeks, `claude-sonnet-4-6` for
  milestones. Structured output via the `record_life` tool. Prompt caching on.
- New world facts go into `STORY.md` **first**, then code. Never invent lore inline.
- Crypto (`packages/chain`) is **optional, isolated, off by default** — Solana + USDC,
  non-custodial, keepsakes only. The core must build/run/test with it absent; it never
  gates gameplay and never touches souring/illness/death. See `ARCHITECTURE.md` §13.
- Self-tending (`packages/atelier`, "the Dreaming") is **optional, isolated, off by
  default** — a grown creature may *propose* improvements to itself and its world, but
  **a creature proposes; only a human disposes**: every wish is a human-reviewed
  proposal, never auto-applied, never mutating state, never touching
  souring/illness/death. The `selfTending` flag (`@amabo/shared` `resolveFeatures`) is
  off by default; the seed backlog is `WISHES`. See `STORY.md` §7⅞, `ARCHITECTURE.md`
  §17, `docs/SELF_TENDING.md`.
- **Auth & ownership:** OAuth-first sessions (httpOnly+SameSite cookies, CSRF). Every
  creature/journal/star query is **owner-scoped**; a missing `owner_id` filter is a
  bug that blocks merge. Cross-owner reads return 404, not 403.
- **Sharing is core and off-chain:** visits are read-mostly, meetings use the pure
  `engine.resonate` (a duet, never a duel), rehoming is double-confirmed and audited.
  Share links are scoped, revocable, expiring capability tokens. See `ARCHITECTURE.md`
  §14 and `STORY.md` §7¾.
- Secrets in `apps/api/.env` (`ANTHROPIC_API_KEY`, `DATABASE_URL`); never in code.
- Conventional commits; one milestone ≈ one PR; a failing acceptance test blocks merge.

## Definition of Done

Failing test written first and now green · whole suite green (no regressions) ·
engine purity intact · boundaries zod-validated · lore terms correct · docs updated if
they changed.

## Commands

```bash
pnpm install
pnpm test                              # vitest across packages
pnpm --filter engine test --coverage   # keep the core ~100%
pnpm db:generate && pnpm db:migrate    # drizzle-kit
pnpm --filter api dev                  # :3000
pnpm --filter web dev                  # :5173
```

## Status

Greenfield. Begin at **M0** in `IMPLEMENTATION_PLAN.md` and proceed in order. Keep the
engine fully unit-tested and behavior-frozen before building persistence on top of it.

**Client & deploy:** PWA-first web app (`apps/web`) → Expo/React Native later, reusing
the platform-agnostic `engine`; no Swift. Deploy on **Railway** (Express API + managed
Postgres; lazy model = no always-on worker). See `ARCHITECTURE.md` §15–16.

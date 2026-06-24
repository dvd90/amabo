# Amabo / the Amarium

A Tamagotchi-style pocket device holding one creature that lives on its own clock
inside a sealed glass world, **the Amarium**. You are _the Light_: your attention is
the warmth it grows by, into a radiant **Amabo** or an uncanny, longing **Yim**.

> Start with `CLAUDE.md`, then read `docs/STORY.md` → `docs/ARCHITECTURE.md` →
> `docs/IMPLEMENTATION_PLAN.md`. STORY.md is the soul: the myth _is_ the spec.

## The two laws

1. **The engine owns all logic.** `packages/engine` is pure — no I/O, no `Date.now()`,
   no `Math.random()` (time and randomness are injected). It decides _what_ happens.
2. **The AI owns only flavor.** `packages/ai` turns engine state into the creature's
   voice (STORY.md §9). It never mutates state.

## Layout

```
amabo/
├── apps/  web/ (the device, PWA) · api/ (Express + engine host)
└── packages/  engine/ (pure core ★) · ai/ (narration) · shared/ (zod + lore consts)
```

## Commands

```bash
pnpm install
pnpm test          # vitest across packages
pnpm typecheck     # tsc project references
pnpm lint          # eslint (enforces engine purity)
pnpm format        # prettier --write
```

Stack: TypeScript · Express · PostgreSQL via Drizzle · Vite + React PWA · Vitest ·
deploy on Railway. Status: **M0 (scaffolding) complete.**

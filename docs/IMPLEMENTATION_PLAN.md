# IMPLEMENTATION_PLAN.md — Amabo / the Amarium

> The build order, and the **test/feedback loop** Claude Code runs on every task.
> Pairs with `ARCHITECTURE.md` (what) and `STORY.md` (why). TDD is not optional here.

## 1. The feedback loop (the rhythm for every task)

For each unit of work, Claude Code runs this loop and does not skip steps:

```
1. READ      → re-read the relevant §STORY.md and §ARCHITECTURE.md for this task.
2. RED       → write the failing test(s) that encode the acceptance criteria.
3. GREEN     → write the minimum implementation to pass. Nothing more.
4. RUN       → `pnpm test`. All green, including prior tests (no regressions).
5. REFACTOR  → clean up; keep tests green; no behavior change.
6. REVIEW    → check against the two laws + the milestone's Definition of Done.
7. DOC       → if behavior/lore changed, update the docs in the same commit.
8. COMMIT    → conventional commit; one milestone ≈ one PR.
```

**Layered loops** (each milestone uses the ones that apply):

- **Unit (engine)** — pure functions, seeded RNG, snapshot tests. Fastest, richest.
- **Contract (ai)** — mock the Anthropic SDK; assert schema-valid output + fallback.
- **Integration (api+db)** — real Drizzle against a test Postgres; mocked clock.
- **E2E (device)** — the full loop playable in a browser.
- **Vibe loop (narration)** — a manual checklist: do the journals *read* like
  `STORY.md` §9? Amabo warm-and-secure, Yim uncanny-and-longing, graduation
  valedictory? Flavor is reviewed by a human, never asserted by string-match.

## 2. Definition of Done (applies to every task)

- Failing test written first; now passing; whole suite green.
- `packages/engine` purity intact: **no** `pg`, `@anthropic-ai/sdk`, `Date`,
  `Math.random` imported there.
- All cross-boundary data validated with shared zod schemas.
- Lore terms used as named in `STORY.md` (no `hunger` where the design says `ambra`).
- Docs updated if anything in them changed. No secrets in code.

## 3. Milestones (each shippable & demoable)

### M0 — Scaffolding
pnpm workspaces, TS project refs, Vitest, eslint/prettier, CI (`pnpm test` on PR),
empty `engine`/`ai`/`shared` compiling.
*Accept:* one trivial engine test runs green in CI.

### M1 — Engine: Ambra, decay, the tick
`CreatureState`, `config.ts` constants, seeded `Rng`, `advance` (decay + sleep +
Ambra), fixed sim-step chunking.
*Accept:* **frame-rate-independence** test passes; decay tests pass; 100% coverage on
touched files.

### M2 — Engine: interactions, events, illness
`interact` (feed/clean/play/comfort/sleep/wake), the weighted event table, illness
from neglect.
*Accept:* feed/over-feed/`refused`, neglect→illness, fixed-seed event snapshot.

### M3 — Engine: disposition (Amabo ↔ Yim) + redemption
Disposition drift in `advance`; `comfort` as the redemption lever; Amabo- vs
Yim-leaning event tables; `uncanny` derivation.
*Accept:* scripted neglect → Yim; scripted `comfort` → pulled back toward Amabo;
disposition stays in [−100, 100].

### M4 — Engine: stages, multiply, graduation
Stage gates (Mote→Bloom), `multiply` (Symposium conservation), `graduate` (high-Amabo
Bloom → `Star`).
*Accept:* scripted care → asserted stages; Yim **cannot** graduate; `multiply`
conserves Ambra; `graduate` emits a valid `Star`.

### M5 — Persistence + API (lazy catch-up)
Drizzle schema + migrations (incl. `stars`); the six endpoints; edge-injected clock.
*Accept:* integration test — create, advance mocked clock, GET shows correct decay;
interact persists; graduation writes a `stars` row.

### M5.5 — Accounts & Auth
Users own Amariums. OAuth-first sign-in (Google; Apple later for app stores), server
sessions via httpOnly+SameSite cookies, CSRF protection, rate limiting. Add `owner_id`
to creatures and **owner-scope every query**. Capture date-of-birth / age band at
signup (needed for the child-safety + optional-crypto gates). See `ARCHITECTURE.md` §14.
*Accept:* unauthenticated requests to creature routes are rejected; a user can only
read/mutate their own creatures (cross-owner access returns 404, not 403, to avoid
leaking existence); OAuth round-trip works end-to-end; session fixation/CSRF tests pass.

### M6 — AI narration
`narrate`, `record_life` tool-use, zod validation, **prompt caching**, local fallback;
Amabo/Yim register selection from disposition.
*Accept:* contract test with mocked SDK; malformed output falls back without throwing;
milestone vs. peek routes to Sonnet vs. Haiku. Then run the **vibe loop** once by hand.

### M7 — Memory distillation
`memories` table; `newMemories` emission; context sends only top-N by salience.
*Accept:* context token size stays roughly flat as the journal grows (assert cap).

### M8 — The device UI
`<Device>` shell, `<Amarium>` LCD (amber glow ← Ambra), `stage × disposition` sprites,
button-only nav, all screens incl. **Comfort**, **Journal**, **Sky** wired to the API.
*Accept:* full loop playable in a browser; "peek" shows the away-journal; a graduated
creature appears as a named star in the Sky.

### M9 — Polish
Audio (blips, ambient loop, graduation swell), lights-off/sleep, `peek` debounce,
mortality toggle (soft default), full a11y pass (keyboard A/B/C, reduced-motion,
high-contrast text mode).
*Accept:* a11y checklist green; soft vs. classic mortality both verified.

*(Post-v1: `CronScheduler` for eager/real-time life + notifications — interface
already stubbed in M0/M5.)*

### M9.5 — Sharing & Resonance (core social, off-chain)
The multiplayer hook, no crypto required. See `ARCHITECTURE.md` §14 and `STORY.md`
§7¾. Four capabilities:
- **Visits ("more than one Light").** A revocable, unguessable share link lets another
  user *look in* (read-mostly) and leave one kind word; a visit gently warms the
  creature. No guest can control your creature.
- **Resonance meetings.** Two consenting users' creatures meet; the **pure**
  `engine.resonate(a, b)` rule (deterministic, seeded, TDD'd) emits a shared journal
  beat and small trait/disposition nudges — a duet, never a duel. Matchmaking/consent
  lives in `api`; the rule lives in `engine`.
- **Rehoming / gifting.** Pass a creature (or a Symposium split-child) to another
  user's Amarium via server transfer, with explicit confirmation on **both** sides.
  (On-chain permanence is the optional M10 upgrade, not required here.)
- **Postcards.** Export a graduation/journal moment as a public, read-only
  image/link for sharing.
Safety: capability-token links (scoped, revocable, expiring); visits are read-mostly;
rehome is double-confirmed and audited; report/block on every social surface;
age-gated where required.
*Accept:* `engine.resonate` is pure and snapshot-tested; a visit link warms the
creature and can be revoked; a rehome moves ownership only after both confirmations and
writes an audit row; a guest cannot mutate a host's creature; postcard renders without
exposing private data.

### M10 — *Optional* exchange layer (`packages/chain`) — **gated**
Implements `STORY.md` §7½ / `ARCHITECTURE.md` §13: Solana + USDC, embedded
non-custodial wallet, inscribe-a-star keepsakes (soulbound, one-of-one), non-custodial
gift/rehome. Feature-flagged **off** by default.
**Do not start until:** the core game (M0–M9) ships and is loved *without* crypto, AND
legal review + age-gating/geofencing are in place.
*Accept:* whole app builds, runs, and passes every test with the flag **off** and the
package absent (`NoopChain`); with the flag on, inscribe + rehome work end-to-end on a
testnet; no gameplay path depends on the chain; no money mechanic touches
souring/illness/death.

## 4. Suggested order & dependencies

```
M0 → M1 → M2 → M3 → M4 → M5 → M5.5 → M6 → M7 → M8 → M9 → M9.5 → (M10 optional)
                    └─ engine done & unit-tested ─┘   auth ↑      ↑ sharing
```
Keep the engine 100%-tested and frozen in behavior before building the API on top of
it; everything above depends on its determinism. Auth (M5.5) lands as soon as
persistence exists so ownership scoping is baked in from the start, not retrofitted.
Sharing (M9.5) comes after the single-player loop is fun on its own.

## 5. Commands

```bash
pnpm install
pnpm test                              # vitest across packages
pnpm --filter engine test --coverage   # the core — keep coverage ~100%
pnpm db:generate && pnpm db:migrate    # drizzle-kit
pnpm --filter api dev                  # express :3000
pnpm --filter web dev                  # vite :5173
```

## 6. Guardrails the agent must not cross

- Never put game logic in `packages/ai`; never put I/O in `packages/engine`.
- Never let the AI mutate state — it returns text only; the engine already decided
  what happened.
- Never invent lore inline. New world facts go into `STORY.md` first, then code.
- The `chain` layer (if built) is a leaf: never imported by `engine`/`ai`/core `api`;
  the app must build, run, and pass all tests with it absent. No money mechanic may
  touch souring, illness, or death.
- A failing milestone acceptance test blocks the PR. No green, no merge.

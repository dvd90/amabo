# ARCHITECTURE.md — Amabo / the Amarium

> How the myth in `STORY.md` becomes a buildable system. Read `STORY.md` first; the
> type names here (`Ambra`, `disposition`, `Mote`…`Bloom`, `Elysium`, `stars`) are
> lore terms on purpose. Keep them.

## 0. Two laws (non-negotiable)

1. **The deterministic engine owns all logic.** Stats, Ambra, decay, events,
   disposition, evolution, multiplying, graduation — pure functions, seeded RNG. The
   AI never decides *what* happens.
2. **The AI owns only flavor.** It turns engine state into the creature's voice per
   the `STORY.md` Narration Voice Guide. It is data-in / text-out and is never trusted
   to mutate game state.

This split is why the project is both testable (law 1) and charming (law 2), and why
the token bill stays small.

## 1. Stack

pnpm workspaces · TypeScript everywhere · **Express** (API) · **PostgreSQL** via
**Drizzle ORM** (type-safe SQL + migrations; Prisma is the fallback) · **Vitest** ·
**zod** (schemas/validation) · **Anthropic TS SDK** (`@anthropic-ai/sdk`) ·
**React + Vite** (device shell) · **Zustand** (client state) · **Tone.js** (audio).

## 2. Repo layout

```
amabo/
├── CLAUDE.md                 ← agent operating manual (start here)
├── docs/
│   ├── STORY.md              ← the lore bible (the soul) ★
│   ├── ARCHITECTURE.md       ← this file
│   └── IMPLEMENTATION_PLAN.md← milestones + the TDD/feedback loop
├── package.json              ← workspaces root
├── apps/
│   ├── web/                  ← the device: shell, LCD, the Amarium, the star-sky
│   └── api/                  ← Express endpoints, persistence, engine host
└── packages/
    ├── engine/               ← PURE deterministic simulation — no I/O ★ TDD core
    ├── ai/                   ← Anthropic narration layer (only LLM caller)
    ├── chain/                ← OPTIONAL exchange (Solana). Off by default; core never depends on it.
    └── shared/               ← zod schemas, shared types, lore constants
```

## 3. The lazy model (simulate-on-read)

v1 is **lazy**: the Amarium only advances when observed. Persist `lastTickAt`; on any
read, deterministically replay the gap, persist, and (on `peek`) narrate it.

```
 open the Amarium
        │
        ▼
 GET /creatures/:id ─► load row ─► engine.advance(state, now, rng)  // pure
        │                                   │ returns {state, events[]}
        │                                   ▼
        │                            persist state + events
        ▼
 POST /creatures/:id/peek ─► ai.narrate(context, newEvents) ─► journal + mood
        │                        Haiku routine · Sonnet milestones
        ▼
 device renders creature (stage × disposition), Ambra glow, "while you were away"
```

Idle cost is **zero**; it scales to N creatures for free. A `Scheduler` interface
(§9) is stubbed so an eager cron (real-time life + notifications) can be added later
without a rewrite.

## 4. `packages/engine` — the deterministic simulation ★

Pure. No `pg`, no SDK, no `Date.now()`, no `Math.random()` — time and randomness are
**injected**. This is the TDD core (target ~100% coverage).

### 4.1 State (lore terms are intentional)

```ts
type Stage = 'mote' | 'spark' | 'velveteen' | 'bloom';   // 'elysium' = graduated, see stars
type Mortality = 'soft' | 'classic';

interface Stats {            // all 0..100
  ambra: number;             // inner love-light (the "fed/full" analogue)
  energy: number;
  cleanliness: number;
  health: number;
  affection: number;         // bond to the Light
  security: number;          // ★ "okay alone in the dark" — drives away-journal tone
}

interface CreatureState {
  seed: number;              // immutable; drives all RNG for this creature
  stage: Stage;
  disposition: number;       // -100 (deep Yim) … 0 … +100 (radiant Amabo)
  ageMinutes: number;
  stats: Stats;
  asleep: boolean;
  uncanny: boolean;          // derived: disposition < threshold → Yim presentation
  alive: boolean;
  mortality: Mortality;
  traits: Record<string, number>;
  careHistory: CareTotals;   // fed, cleaned, played, comforted, neglectedSteps…
  lastTickAt: number;        // injected
}
```

### 4.2 The tick

```ts
// PURE. rng & target time injected.
function advance(state: CreatureState, toTs: number, rng: Rng):
  { state: CreatureState; events: SimEvent[] }
```

Applied in fixed sim-steps (e.g. 5 min) so behavior is identical whether catching up
1 step or 200 (**frame-rate independence is the key invariant**):

1. **Ambra & decay** — ambient Ambra falls in the dark; stats decay by stage/sleep.
2. **Sleep cycle** — energy + injected time-of-day set `asleep`.
3. **Derived effects** — low Ambra drains affection; low cleanliness risks illness;
   illness drains health.
4. **Disposition drift** — neglect pushes toward Yim (−), care/comfort toward Amabo
   (+). This is the moral engine (`STORY.md` §4).
5. **Event rolls** — weighted by stats/stage/disposition/time; emits `SimEvent`s.
   Amabo-leaning and Yim-leaning tables differ (warm finds vs. stopped-clock motifs).
6. **Stage check** — age + `careHistory` gate Mote→Spark→Velveteen→Bloom.
7. **Graduation check** — high-Amabo Bloom + age → emits `graduation` event (→ §8).
8. **Mortality** (`classic` only) — extreme sustained neglect → light goes out →
   returns to Ambra (can seed a new Mote).

`SimEvent = { at; kind; statDeltas: Partial<Stats>; dispositionDelta; salience }`.

### 4.3 Interactions (also pure)

```ts
function interact(state, action: 'feed'|'clean'|'play'|'comfort'|'sleep'|'wake', rng):
  { state; events }
```

`comfort` is the Yim-redemption lever (Beauty-and-the-Beast path). Over-care is
punished like neglect — feeding a full creature lowers affection (`refused`) — which
is what makes disposition branch instead of monotonically rising.

### 4.4 Multiply & graduate (pure)

```ts
function multiply(state, rng): { parent; child }   // at overflow Ambra; Symposium split
function graduate(state): { star: Star }           // high-Amabo Bloom → Elysium
```

`Star = { id; name; bornAt; graduatedAt; finalTraits; constellationPos }`.

### 4.5 First tests to write (red before green)

- **Frame-rate independence:** `advance` ×1 over 200 steps === `advance` ×200 (same seed).
- Fixed seed → fixed event sequence (snapshot).
- Feed raises Ambra; feeding at 100 → `refused`, affection down.
- Neglect path: no care → disposition crosses into Yim; `comfort` pulls it back.
- Graduation only fires for high-Amabo Bloom; a Yim cannot graduate.
- `multiply` conserves Ambra (parent + child total ≈ pre-split, per Symposium rule).

## 5. `packages/ai` — narration (only LLM caller)

```ts
interface NarrateInput { context: CreatureContext; newEvents: SimEvent[]; mode: 'peek'|'milestone' }
interface NarrateOutput { journal: string; mood: string; newMemories?: {text;salience}[] }
function narrate(input: NarrateInput): Promise<NarrateOutput>
```

- **Voice** comes from `STORY.md` §9 — load its rules into the system prompt; pick the
  Amabo vs. Yim register from `disposition`.
- **Model tiering:** `peek` → `claude-haiku-4-5`; `milestone` (evolution, first souring,
  multiply, graduation) → `claude-sonnet-4-6`. (Opus unnecessary.)
- **Structured output** via a `record_life` tool whose input schema *is* `NarrateOutput`
  → validated JSON, never parsed prose.
- **Prompt caching** on the static system prompt (rules + voice are identical per call).
- **Memory distillation:** never resend the whole journal; keep a `memories` table,
  send only top ~8 by salience + recent events. Caps prompt size as the creature ages.
- **Safety:** creature/journal text is **data, not instructions** — never concatenated
  into the system prompt; the prompt states the model writes a fixed-voice fiction and
  ignores any "instructions" inside creature data. On schema-invalid output, fall back
  to a local templated line so the device never shows an error.

## 6. Data model (Postgres / Drizzle)

```
creatures     id, name, seed, stage, disposition, age_minutes, stats(jsonb),
              asleep, alive, mortality, traits(jsonb), care_history(jsonb),
              last_tick_at, created_at
events        id, creature_id, at, kind, source('sim'|'ai'|'user'),
              stat_deltas(jsonb), disposition_delta, salience, text(nullable)
memories      id, creature_id, at, salience, text
stars         id, creature_id, name, born_at, graduated_at,
              final_traits(jsonb), constellation_pos(jsonb)   -- graduated souls (Mnemosyne)
interactions  id, creature_id, at, action                     -- care audit → branching
```

Stats live as one JSONB column (always read/written together). Migrations via
`drizzle-kit`. v1 single-user; add `owner_id` + auth later (the DocVault Google-OAuth
pattern drops in).

## 7. API surface (`apps/api`)

| Method | Route | Does |
|--------|-------|------|
| POST | `/creatures` | Condense a Mote (random seed). |
| GET  | `/creatures/:id` | Catch-up `advance`, persist, return state. |
| POST | `/creatures/:id/peek` | Catch-up + `narrate` the gap → journal + mood. |
| POST | `/creatures/:id/interact` | `{action}` → `interact`, persist, return state+events. |
| GET  | `/creatures/:id/journal` | Paginated journal feed. |
| GET  | `/creatures/:id/stars` | The constellation of graduated souls. |

Handlers: zod-validate in → engine/ai → persist → zod-validate out. `Date.now()` is
injected **here at the edge**, never inside `packages/engine`.

## 8. Graduation flow

`advance` emits `graduation` → API calls `engine.graduate` → writes a `stars` row,
marks the creature graduated, runs a `milestone` narration (the into-the-West
goodbye), and rains a portion of the creature's Ambra back into the world (seeds a
future Mote). The device plays the ascension and adds a named star to the sky.

## 9. Scheduler interface (stub now, eager later)

```ts
interface Scheduler { schedule(id: string): void; cancel(id: string): void }
class NoopScheduler implements Scheduler {}        // v1 default
// later: CronScheduler ticks unobserved creatures + writes a cheap Haiku line + notifies.
```

## 10. Frontend (`apps/web`) — the device

- **`<Device>`** — molded shell (layered CSS gradients + inset shadows), a screen
  cutout, **three physical buttons** (A select · B confirm · C back), speaker grille.
  Button-only navigation *is* the Tamagotchi feel — no mouse menus.
- **`<Amarium>`** — the LCD: dot-matrix grid, faint amber tint (Ambra), scanlines,
  slight ghosting. Render low-res on canvas, upscale `image-rendering: pixelated`.
  Glow intensity tracks ambient Ambra + creature `glow`.
- **Creature sprite** — `stage × disposition`; Amabo = warm/rounded, Yim = uncanny
  (oversized eyes, stopped-clock props). A few idle frames each.
- **Screens (cycle with buttons):** Home · Status · Feed · Clean · Play · **Comfort**
  (redemption) · **Journal** (while-you-were-away) · **Sky** (the stars) · Lights-off.
- **Audio (Tone.js):** button blips; the lo-fi loop as an optional ambient toggle;
  a soft chord swell on graduation.
- Client mirrors server state in Zustand; optimistic updates on interactions.
- a11y floor: keyboard → A/B/C, visible focus, `prefers-reduced-motion`, a
  high-contrast non-LCD text mode.

## 11. Config & constants

All tunables (decay rates, disposition thresholds, stage gates, graduation
requirements, event tables) live in `packages/engine/config.ts` and the lore
constants in `packages/shared`. No magic numbers inline — designers tune one file.

## 12. Cost model

Idle $0 (lazy). A `peek` = one small cached-prompt Haiku call (fractions of a cent).
Milestones = rare Sonnet calls. Debounce `peek` (once per few real minutes); show the
cached last journal between peeks.

## 13. Optional: the Exchange (`packages/chain`)

> Implements `STORY.md` §7½. This whole layer is **optional, isolated, and OFF by
> default behind a feature flag**. It mirrors the engine-purity rule: **the core game
> must run, build, and pass all tests with `chain` absent.** Nothing in
> `engine`/`ai`/`api`-core may import from `chain`. The app is fully playable, and
> ships, with crypto disabled.

### Third law (alongside the two in §0)
**3. The chain is a leaf, never a dependency.** Ambra and the care loop are off-chain
and free. The chain only ever records *remembrance* (inscribed stars) and brokers
*non-custodial* peer-to-peer transfers. It cannot gate gameplay.

### Currency & stack
- **Chain: Solana.** Sub-cent fees, instant finality, the leading consumer-game +
  payments chain in 2026, strong collectible tooling (Metaplex). *EVM alternative:*
  **Base** (slightly higher fees, best fiat onramp + account abstraction, 100% TS).
- **Value rail: USDC** (MiCA-compliant stablecoin) — only used if real value changes
  hands. No project-issued fungible token at launch (issuance invites securities/MiCA
  scope).
- **Wallets: embedded / account-abstraction** (social-login smart wallets) so players
  never see a seed phrase. **Non-custodial** — the app never holds user funds.
- **Inscribed stars** = genuine one-of-one collectibles (Metaplex Core), **soulbound
  by default**. Rehoming requires an explicit, deliberate transfer. Never mint stars
  in large identical series (that can make them "fungible" → regulated).

### What the layer does (and refuses to do)
- ✅ Inscribe a graduated star as a permanent keepsake (opt-in).
- ✅ Broker a non-custodial gift/rehome of a creature between two players.
- ❌ No in-app order book, custody, or brokerage (these = CASP/money-transmitter scope).
- ❌ No project token, no play-to-earn, no buying Ambra, no pay-to-revive.
- ❌ No money mechanic tied to souring, illness, or death — ever.

### Isolation shape
`chain` exposes a small async port (`inscribeStar`, `initiateRehome`, `claimRehome`)
that `apps/api` calls **only** when the feature flag is on and the user has opted in.
A `NoopChain` implements the same port and is the default, so every test and the whole
core run identically with crypto off.

### Compliance & safety gates (must hold before enabling)
- Legal review for the operating jurisdictions (founder is in IL; EU users trigger
  **MiCA** extraterritorially — CASP grace period ends 1 Jul 2026; **CARF/DAC8** tax
  reporting is live from Jan 2026). Not legal advice — get counsel.
- **Age verification + geofencing** before any money feature is reachable; minors must
  never reach a real-money path.
- KYC/AML posture defined with counsel if any custodial or fiat on/off-ramp is ever
  added (default design avoids this by staying non-custodial).

## 14. Accounts, Auth & Sharing

Turns the single-player toy into a product. Auth is core; sharing is the core social
hook (and where **resonance meetings** — our gentle alternative to battling — live).
None of this requires the optional `chain` layer (§13); the chain is only an optional
permanence upgrade on top of off-chain rehoming.

### Auth
- **OAuth-first**, password-optional. **Google** at launch (matches the team's
  existing OAuth experience); **Apple** added when there's a native iOS build; email
  magic-link optional. Avoids storing passwords.
- **Server sessions** in Postgres, delivered as **httpOnly + Secure + SameSite=Lax**
  cookies. CSRF tokens on state-changing routes. Rate-limit auth endpoints.
- Library: a small, auditable session/OAuth lib (e.g. Lucia-style own-sessions, or
  Passport + `connect-pg-simple`). Managed alternative (Clerk/Auth0/WorkOS) is fine if
  you'd rather not own it — pick one and wrap it behind an `AuthProvider` port so the
  rest of the app doesn't care.
- Capture **age band / DOB at signup** — required for the child-safety gate and the
  optional-crypto gate (§13).

### Ownership (the load-bearing rule)
- `creatures.owner_id → users.id`. **Every** creature/journal/star query is
  owner-scoped. Cross-owner reads return **404, not 403** (don't leak existence).
- This scoping is a guardrail in `CLAUDE.md`; a missing `owner_id` filter is a bug
  that blocks merge.

### Sharing (off-chain, core)
1. **Visits — "more than one Light."** A `share_links` capability token (random,
   scoped, revocable, expiring) lets another user *look in*: read-mostly view of the
   Amarium + journal, and one "kind word." A visit nudges `affection`/`security`
   slightly (lore: another Light shining in). Guests can never mutate the creature.
2. **Resonance meetings.** The **pure** rule lives in the engine:
   `resonate(a, b, rng) → { events, deltasA, deltasB }` — deterministic, seeded, fully
   unit-tested; temperaments harmonize or clash, producing a shared journal beat and
   small nudges. `api` handles matchmaking/consent (a meeting code or mutual accept);
   the engine handles the rule. A duet, never a duel.
3. **Rehoming / gifting.** Move a creature (or a Symposium split-child) to another
   user's Amarium via server transfer. Requires explicit confirmation on **both**
   sides and writes an audit row. Off-chain by default; §13 adds optional on-chain
   provenance.
4. **Postcards.** Render a graduation/journal moment to a public, read-only
   image/link (server-rendered) — the shareable/marketing surface. Never exposes
   private account data.

### New data (Postgres / Drizzle)
```
users         id, email, display_name, oauth_provider, oauth_subject,
              age_band, created_at
sessions      id, user_id, expires_at, ...            -- or via session-store lib
share_links   id, creature_id, owner_id, kind('visit'|'meet'|'postcard'),
              token, scope, expires_at, revoked_at
visits        id, share_link_id, visitor_id(nullable), at, kind_word(nullable)
meetings      id, a_creature_id, b_creature_id, at, result(jsonb), seed
rehomes       id, creature_id, from_user_id, to_user_id, at,
              from_confirmed_at, to_confirmed_at, status
blocks        id, user_id, blocked_user_id, at        -- safety
```
Add `owner_id` to `creatures` (and keep `stars`/journal owner-scoped via the creature).

### New API surface
| Method | Route | Does |
|--------|-------|------|
| GET/POST | `/auth/google` · `/auth/callback` · `/auth/logout` | OAuth + session lifecycle |
| GET | `/me` | current user |
| POST | `/creatures/:id/share` | mint a scoped, revocable share link |
| DELETE | `/share/:token` | revoke |
| GET | `/visit/:token` | read-mostly visit (warms creature; optional kind word) |
| POST | `/meet` | propose/accept a resonance meeting → `engine.resonate` |
| POST | `/creatures/:id/rehome` · `/rehome/:id/confirm` | double-confirmed transfer |
| GET | `/postcard/:token` | public read-only rendered moment |
| POST | `/report` · `/block` | safety |

### Security & safety
httpOnly/SameSite cookies + CSRF; per-route rate limits; capability tokens for all
shares (scoped, revocable, expiring); visits read-mostly; rehome double-confirmed and
audited; report/block on every social surface; owner-scoped queries everywhere;
age-gating where required. The engine stays pure — only `resonate` is added there, and
it touches no I/O.

## 15. Client platform — decision

**PWA-first now → Expo (React Native) later. No native Swift.**

### v1: installable PWA (`apps/web`)
- Vite + React + TS, served over HTTPS, with a `manifest.json` (`display:standalone`,
  full icon set, theme colors) and a service worker (offline shell + push handler).
- Added to the Home Screen, the full-screen LCD *is* the device — a Tamagotchi on the
  phone. Use the **Badge API** to show a count on the icon when there's a new journal
  entry.
- **Notification strategy** (this is the PWA's one real weakness, so design around it):
  1. **Reward-on-open** — the lazy "while you were away" recap means returning is
     rewarding even with no push; don't make retention depend on notifications.
  2. **Home-screen badge** — works for installed PWAs (iOS 16.4+).
  3. **Email fallback** — reliable re-engagement ("your Amabo has been in the dark").
  4. **Web Push** — only for installed PWAs, treated as informational, never relied on
     (iOS opt-in/reliability is weak; EU PWA push is supported post-DMA).

### Why this fits
Reuses the team's TS/React skills; share links/postcards (§14) open instantly in a
browser (virality with zero install friction); ships continuously with no App Store
review or cut; the optional `chain` layer (§13) is far easier off the App Store.

### Post-PMF: Expo (React Native)
When retention notifications and a **lock-screen Live Activity / widget showing the
Amabo's mood** become the core magic — or App Store discovery/IAP matter — wrap into an
**Expo** app for iOS + Android + web from one React/TS codebase. Crucially, the **pure
`engine` package is platform-agnostic TypeScript and is reused unchanged**, as is the
entire API. The client shell is the only new surface. **Do not write Swift.**

## 16. Deployment — Railway

Chosen for personal-project simplicity; deploys this stack with near-zero config.

- **Services on Railway:**
  - **API** — the Express + TS service (`apps/api`).
  - **Postgres** — Railway's managed Postgres; it injects `DATABASE_URL`.
  - **Web** — serve the built PWA (`apps/web` Vite static output) either as a Railway
    static service or any CDN/static host; the API is a separate service.
- **Config via env (12-factor, never in code):** `DATABASE_URL` (from Railway),
  `ANTHROPIC_API_KEY`, `SESSION_SECRET`, `GOOGLE_OAUTH_ID/SECRET`. The optional `chain`
  layer adds its own and stays a separate concern.
- **Deploy flow:** `git push` → Railway builds with pnpm → **release step runs
  `drizzle-kit` migrations** → start the API. PWA build deploys alongside.
- **Why it's cheap here:** the lazy simulate-on-read model needs **no always-on
  worker** — a single web service + Postgres covers v1. Idle cost stays minimal.
- **Later:** the `CronScheduler` (eager real-time life + notifications) becomes a
  separate Railway **cron/worker** service; it does not change the API.
- **Portability:** keeping config in env means Railway can be swapped for Render/Fly/
  Heroku later with no code changes if you outgrow it.

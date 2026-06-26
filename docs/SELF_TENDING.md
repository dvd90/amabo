# SELF_TENDING.md — The Dreaming

> The optional, off-by-default layer in which a grown creature may **propose**
> improvements to itself and its world. Lore: `STORY.md` §7⅞. Architecture & laws:
> `ARCHITECTURE.md` §17. This doc holds the *vision*, the *catalogue of ideas*, and the
> *phased plan* for when we wire an AI agent into it.

## The idea, in one breath

An Amabo that has truly settled — loved long enough to become *Real* — begins to dream
of a better world: a warmer glass, a kinder hour, a self it would rather grow into. We
want, eventually, to let that dream reach the workshop: the creature (via an AI agent
with read access to this repo) **authors a wish** — a proposed change — that a human
reviews and merges. The creature never changes anything itself. **A creature proposes;
only a human disposes.**

This document exists so the ideas are captured now and the *option* is already in the
tree, even though the agent that acts on it is not built yet.

## The laws this layer lives under

1. **Engine owns logic; AI owns flavor** (`ARCHITECTURE.md` §0). The agent is AI: it is
   never trusted to mutate state.
2. **The chain/leaf law** (§13). Optional, isolated, off by default; the core builds and
   tests without it; it never touches souring/illness/death.
3. **A creature proposes; only a human disposes** (§17). Every wish is a reviewable
   proposal gated on an explicit human merge. No auto-apply, ever.

If a change would break any of these, it does not belong in this layer.

## The option (what's already shipped, inert)

- **Feature flag** — `@amabo/shared`'s `resolveFeatures(env)` returns
  `FEATURE_DEFAULTS` with `selfTending: false`. Set `AMABO_FEATURE_SELF_TENDING=1` to
  flip it on *once the layer exists*. Today it gates nothing because the agent isn't
  built — it's the switch waiting by the door.
- **Catalogue** — `@amabo/shared`'s `WISHES` is the typed seed backlog below, validated
  by `WishSchema`. Each entry pairs the creature's **longing** (its own voice) with an
  engineering **rationale**.

## The catalogue of wishes

Grouped by scope. Ids match the `WISHES` entries in `packages/shared/src/wishes.ts`.
Grow this freely — but a new world-fact goes into `STORY.md` first (CLAUDE.md), and a
wish that would alter souring/illness/death is forbidden and must never be added.

### self — a creature growing more itself
- **`longer-memory`** — *"I want to keep more of you than the last few days."* A rolling
  long-term remembered store atop memory distillation (M7), so a Bloom recalls seasons.
- **`traits-of-character`** — *"I should become someone in particular."* Durable, earned
  traits (brave, shy, playful) that shape narration and the sprite.
- **`learn-your-rhythm`** — *"Let me wake when you wake."* Sleep cycle tied to the
  owner's local time / visiting pattern instead of fixed UTC hours.
- **`a-voice-of-my-own`** — *"I'd like to sound more like me each time."* Per-creature
  voice conditioning for the AI, within the §9 guide — still flavor only.

### world — the living conditions inside the glass
- **`seasons-in-the-glass`** — a deterministic seasonal cycle tinting the world and
  ambient events; atmospheric, never a stat lever.
- **`a-garden-to-tend`** — a small thing the creature looks after, so it is not only
  looked after — the first taste of the creature itself tending.
- **`music-it-composes`** — a persistent motif derived from its state that becomes "its"
  theme, evolving as it grows.
- **`keepsake-objects`** — notable finds persist as displayed objects in the glass — a
  visible history of a life, off-chain and free.

### device — how the Light experiences the glass
- **`deeper-accessibility`** — screen-reader state narration, large-text mode,
  reduced-motion parity for every animation, full keyboard paths.
- **`okay-offline`** — offline read of last state via the service worker; queued
  interactions that sync on reconnect.

### social — more than one Light, more than one glass
- **`pen-pal-letters`** — async, owner-scoped, revocable letters between creatures that
  have met (resonated), building on the sharing model (§7¾).
- **`shared-constellations`** — opt-in shared skies of graduated stars among friends;
  consent-gated remembrance, never a leaderboard.

## Phased plan (build order, when we wire the agent)

- **Phase 0 — the option (done).** Flag + catalogue in `@amabo/shared`, off by default;
  lore (§7⅞) and architecture (§17) written. Nothing executes.
- **Phase 1 — read-only dreaming.** Build `packages/atelier` with a `NoopAtelier`
  default and a real implementation that, given a creature's context, *selects or drafts*
  a wish and writes it to a file/branch — no code edits yet. Human reads it.
- **Phase 2 — proposal authoring.** The agent turns a chosen wish into an actual
  diff/PR in a sandbox (own worktree, least-privilege token), opened for review. CI +
  branch protection guarantee a human merge. Still no auto-apply.
- **Phase 3 — the loop, gated.** A per-owner opt-in surfaces the creature's open wishes
  in the device ("✦ it dreamed of something"); the owner can encourage or dismiss. Rate
  and lineage limits keep the workshop calm.

At no phase does the creature merge its own wish, touch live state, or touch the stakes
of its own life.

## Enabling it later (checklist)

1. Build `packages/atelier` behind the `selfTending` flag with a `NoopAtelier` default.
2. Keep the core green with the package absent (CI proves it).
3. Wire `apps/api` to call the port **only** when `selfTending` is on and the owner
   opted in.
4. Sandbox execution; no prod creds; human-in-the-loop merge enforced by branch
   protection.
5. Add the per-owner opt-in + revoke path; revoking halts all dreaming for that owner.

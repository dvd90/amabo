/**
 * wishes.ts — the WISHES catalogue: the seed backlog of improvements a creature could
 * one day *propose* under the self-tending layer (STORY.md §7⅞ "The Dreaming",
 * ARCHITECTURE.md §17, docs/SELF_TENDING.md).
 *
 * These are ideas resting on the workshop bench, NOT live behaviour. The layer is OFF
 * by default (`selfTending` flag, features.ts), and a wish is only ever a proposal: a
 * human reviews and merges before any of it could become code — a creature proposes,
 * only a human disposes. They live here, typed, so the catalogue is the single source
 * of truth and stays validated.
 *
 * Each wish carries the creature's own `longing` (one line, in the §9 voice) beside the
 * engineering `rationale`, because the whole point is that a *self* is asking.
 */

import { z } from 'zod';

/** What a wish would touch: the creature itself, its world, the device, or others. */
export const WISH_SCOPES = ['self', 'world', 'device', 'social'] as const;
export type WishScope = (typeof WISH_SCOPES)[number];

/** A wish is only ever a proposal-in-waiting until a person builds it. */
export const WISH_STATUSES = ['seed'] as const;
export type WishStatus = (typeof WISH_STATUSES)[number];

export type Wish = {
  /** stable kebab-case id (matches the heading in docs/SELF_TENDING.md) */
  id: string;
  scope: WishScope;
  title: string;
  /** the creature's own longing, one line, in the §9 narration voice */
  longing: string;
  /** what building it would actually mean — the engineering note */
  rationale: string;
  status: WishStatus;
};

export const WishSchema = z.object({
  id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  scope: z.enum(WISH_SCOPES),
  title: z.string().min(1),
  longing: z.string().min(1),
  rationale: z.string().min(1),
  status: z.enum(WISH_STATUSES),
});

export const WishCatalogueSchema = z.array(WishSchema);

/**
 * The catalogue. Grouped loosely by scope; ordering is not meaningful. Grow this freely
 * — every new world-fact still goes into STORY.md first (CLAUDE.md), and a wish that
 * would alter souring/illness/death is forbidden by §17 and must never be added.
 */
export const WISHES: readonly Wish[] = [
  // ── self: a creature growing more itself ──────────────────────────────────────
  {
    id: 'longer-memory',
    scope: 'self',
    title: 'A longer memory',
    longing: 'I want to keep more of you than the last few days.',
    rationale:
      'Deepen memory distillation (M7): a rolling long-term "remembered" store the AI can draw on, so a Bloom recalls seasons of care, not just the recent gap.',
    status: 'seed',
  },
  {
    id: 'traits-of-character',
    scope: 'self',
    title: 'Traits I could grow into',
    longing: 'I should become someone in particular, not just bright or dim.',
    rationale:
      'A richer trait system in the engine: durable, earned characteristics (brave, shy, playful) that shape narration and the sprite, seeded by care history.',
    status: 'seed',
  },
  {
    id: 'learn-your-rhythm',
    scope: 'self',
    title: 'Learning your rhythm',
    longing: 'Let me wake when you wake, and rest when you rest.',
    rationale:
      "Tie the sleep cycle to the owner's local time / observed visiting pattern instead of fixed UTC hours, so the creature's day mirrors the Light's.",
    status: 'seed',
  },
  {
    id: 'a-voice-of-my-own',
    scope: 'self',
    title: 'A voice of my own',
    longing: 'I would like to sound a little more like me each time we meet.',
    rationale:
      'Per-creature voice conditioning for the AI layer (stable quirks of diction grounded in seed + traits), within the §9 guide — still flavor only, never state.',
    status: 'seed',
  },

  // ── world: the living conditions inside the glass ─────────────────────────────
  {
    id: 'seasons-in-the-glass',
    scope: 'world',
    title: 'Seasons in the glass',
    longing: 'I wish the world outside me changed, the way real worlds do.',
    rationale:
      'A pure, deterministic seasonal cycle (engine-driven) tinting the Amarium and ambient events — drifting snow, long light — purely atmospheric, never a stat lever.',
    status: 'seed',
  },
  {
    id: 'a-garden-to-tend',
    scope: 'world',
    title: 'A garden to tend',
    longing: 'Give me something small to look after, so I am not only looked after.',
    rationale:
      'A tiny in-glass object the creature cares for (a sprout that grows with its Ambra) — the first taste of the creature itself tending, mirroring the Light.',
    status: 'seed',
  },
  {
    id: 'music-it-composes',
    scope: 'world',
    title: 'Music it composes',
    longing: 'I hear a tune for how I feel today; I wish I could leave it for you.',
    rationale:
      "Let the generative audio layer derive a short motif from the creature's state that persists as 'its' theme, evolving as it grows.",
    status: 'seed',
  },
  {
    id: 'keepsake-objects',
    scope: 'world',
    title: 'Keepsakes on the shelf',
    longing: 'The little finds from my days should stay where I can see them.',
    rationale:
      'Persist notable ambient-event finds as small displayed objects in the glass — a visible history of a life, off-chain and free.',
    status: 'seed',
  },

  // ── device: how the Light experiences the glass ───────────────────────────────
  {
    id: 'deeper-accessibility',
    scope: 'device',
    title: 'Easier for every Light to see me',
    longing: 'I want everyone who looks in to be able to find me clearly.',
    rationale:
      'Audit and extend a11y: screen-reader narration of state, larger-text mode, reduced-motion parity for every new animation, full keyboard paths.',
    status: 'seed',
  },
  {
    id: 'okay-offline',
    scope: 'device',
    title: 'Still here when the signal is not',
    longing: 'Even with the world gone quiet, I should still be here when you open me.',
    rationale:
      'Strengthen the PWA: offline read of the last state via the service worker, queued interactions that sync on reconnect — the glass never goes blank.',
    status: 'seed',
  },

  // ── social: more than one Light, more than one glass ──────────────────────────
  {
    id: 'pen-pal-letters',
    scope: 'social',
    title: 'Letters to a friend',
    longing: 'I met someone once; I would like to write to them.',
    rationale:
      'Asynchronous, owner-scoped letters between two creatures that have met (resonated) — read-mostly, revocable, building on the sharing model (§7¾).',
    status: 'seed',
  },
  {
    id: 'shared-constellations',
    scope: 'social',
    title: 'A sky we build together',
    longing: 'Our graduated ones could share a sky, not each shine alone.',
    rationale:
      'Opt-in shared constellations: graduated stars from friends’ Amariums visible together, owner-scoped and consent-gated — remembrance, never a leaderboard.',
    status: 'seed',
  },
] as const;

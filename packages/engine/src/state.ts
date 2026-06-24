/**
 * state.ts — the shape of a life in the Amarium (ARCHITECTURE.md §4.1). Lore terms
 * are intentional: `ambra` (inner love-light), `disposition` (Amabo+/Yim−), the
 * stage ladder, `security` ("okay alone in the dark"). All numbers live in [0, 100].
 */

import type { Mortality, Stage } from '@amabo/shared';
import { UNCANNY_THRESHOLD } from './config.js';

/** Derived presentation: a soured creature (low disposition) shows as a Yim (STORY.md §4). */
export function deriveUncanny(disposition: number): boolean {
  return disposition < UNCANNY_THRESHOLD;
}

export interface Stats {
  /** Inner love-light — the creature is *made of* Ambra; its glow is this showing through. */
  ambra: number;
  energy: number;
  cleanliness: number;
  health: number;
  /** Bond to the Light (the player's attention). */
  affection: number;
  /** "Okay alone in the dark" — drives the away-journal tone (STORY.md §2). */
  security: number;
}

/** Care audit totals — the branching record that later gates evolution & drift. */
export interface CareTotals {
  fed: number;
  cleaned: number;
  played: number;
  comforted: number;
  neglectedSteps: number;
}

export interface CreatureState {
  /** Immutable; drives all RNG for this creature (ARCHITECTURE.md §4.1). */
  seed: number;
  stage: Stage;
  /** −100 (deep Yim) … 0 … +100 (radiant Amabo). */
  disposition: number;
  ageMinutes: number;
  stats: Stats;
  asleep: boolean;
  /** Sick from sustained neglect (low cleanliness); drains health until it mends. */
  ill: boolean;
  /** Derived: disposition below the uncanny threshold → Yim presentation. */
  uncanny: boolean;
  alive: boolean;
  mortality: Mortality;
  traits: Record<string, number>;
  careHistory: CareTotals;
  /** Last simulated instant (ms epoch); injected at the edge, never read in here. */
  lastTickAt: number;
}

/** Sim-event kinds, growing per milestone. */
export type SimEventKind =
  // M1 — sleep transitions
  | 'fellAsleep'
  | 'woke'
  // M2 — interactions
  | 'fed'
  | 'cleaned'
  | 'played'
  | 'comforted'
  | 'refused'
  | 'tooTired'
  // M2 — illness
  | 'fellIll'
  | 'recovered'
  // M2 — ambient flavor
  | 'ambient'
  // M4 — lifecycle milestones
  | 'evolved'
  | 'graduation'
  // M9 — mortality (classic only)
  | 'lightWentOut';

export interface SimEvent {
  at: number;
  kind: SimEventKind;
  statDeltas: Partial<Stats>;
  dispositionDelta: number;
  /** How noteworthy — narration (M6) sorts/keeps by this. */
  salience: number;
  /** Optional ambient motif (e.g. 'warmSpot', 'stoppedClock') for the narration layer. */
  tag?: string;
}

/**
 * Condense a fresh Mote out of gathered Ambra (STORY.md §1, §8). A new life arrives
 * "trailing clouds of glory": full of light, neutral disposition, rested, content.
 * The API supplies the random `seed` and the `now`; this stays pure.
 */
export function condenseMote(seed: number, now: number): CreatureState {
  return {
    seed,
    stage: 'mote',
    disposition: 0,
    ageMinutes: 0,
    stats: {
      ambra: 70,
      energy: 80,
      cleanliness: 100,
      health: 100,
      affection: 50,
      security: 50,
    },
    asleep: false,
    ill: false,
    uncanny: false,
    alive: true,
    mortality: 'soft',
    traits: {},
    careHistory: { fed: 0, cleaned: 0, played: 0, comforted: 0, neglectedSteps: 0 },
    lastTickAt: now,
  };
}

/**
 * resonate.ts — the meeting rule (STORY.md §7¾, ARCHITECTURE.md §14). PURE and seeded.
 * Two creatures from two Amariums meet; their Ambra resonates — harmonizing when their
 * temperaments are close, gently clashing when far apart — and both come away a little
 * changed, with one shared line in each journal. A duet, never a duel: nothing is
 * damaged. The API handles matchmaking/consent; this owns the rule.
 */

import { RESONANCE, VISIT } from './config.js';
import type { Rng } from './rng.js';
import type { CreatureState, SimEvent, Stats } from './state.js';

export interface ResonanceDelta {
  stats: Partial<Stats>;
  disposition: number;
}

export interface ResonanceResult {
  events: SimEvent[];
  deltasA: ResonanceDelta;
  deltasB: ResonanceDelta;
}

/** Each drifts a little toward the other's disposition (0 if they're identical). */
function pull(self: number, other: number, amount: number): number {
  return Math.sign(other - self) * amount;
}

export function resonate(a: CreatureState, b: CreatureState, rng: Rng): ResonanceResult {
  const gap = Math.abs(a.disposition - b.disposition);
  const harmonize = gap <= RESONANCE.harmonyGap;
  // A small deterministic shimmer so repeated meetings aren't identical, but seeded.
  const shimmer = 0.5 + rng() * 0.5; // [0.5, 1)
  const at = Math.max(a.lastTickAt, b.lastTickAt);

  if (harmonize) {
    const aff = RESONANCE.harmonyAffection * shimmer;
    const sec = RESONANCE.harmonySecurity * shimmer;
    const event: SimEvent = {
      at,
      kind: 'resonance',
      tag: 'harmony',
      statDeltas: {},
      dispositionDelta: 0,
      salience: 3,
    };
    return {
      events: [event],
      deltasA: {
        stats: { affection: aff, security: sec },
        disposition: pull(a.disposition, b.disposition, RESONANCE.harmonyDispositionPull),
      },
      deltasB: {
        stats: { affection: aff, security: sec },
        disposition: pull(b.disposition, a.disposition, RESONANCE.harmonyDispositionPull),
      },
    };
  }

  // A gentle clash: a touch less settled, but even this leaves a trace of warmth.
  const event: SimEvent = {
    at,
    kind: 'resonance',
    tag: 'clash',
    statDeltas: {},
    dispositionDelta: 0,
    salience: 3,
  };
  const delta: ResonanceDelta = {
    stats: {
      security: -RESONANCE.clashSecurity * shimmer,
      affection: RESONANCE.clashAffection * shimmer,
    },
    disposition: 0,
  };
  return { events: [event], deltasA: { ...delta }, deltasB: { ...delta } };
}

/** A visit (read-mostly) — another Light's warmth: a small lift, never a mutation of will. */
export function visitDelta(): ResonanceDelta {
  return { stats: { affection: VISIT.affection, security: VISIT.security }, disposition: 0 };
}

/**
 * needs.ts — PURE. Distils a creature's state into a few "who needs the Light" signals
 * for the dashboard roster (STORY.md §2). A glanceable triage, not the full sim: the
 * engine owns the thresholds so the UI never re-implements them.
 */

import { GAP_SUMMARY, GRADUATION, LOW_AMBRA_THRESHOLD } from './config.js';
import type { CreatureState } from './state.js';

/** Most-urgent-first signals a card can surface. */
export type NeedFlag = 'ready' | 'souring' | 'ill' | 'hungry' | 'lonely' | 'asleep' | 'fading';

/** A radiant Bloom, ripe to ascend — a hint, not the full graduation gate (age/ambra too). */
function readyToAscend(s: CreatureState): boolean {
  return s.stage === 'bloom' && s.disposition >= GRADUATION.disposition;
}

export function needs(state: CreatureState): NeedFlag[] {
  // A creature whose light has gone out: nothing else matters.
  if (!state.alive) return ['fading'];

  const out: NeedFlag[] = [];
  if (readyToAscend(state)) out.push('ready');
  if (state.uncanny) out.push('souring');
  if (state.ill) out.push('ill');
  if (state.stats.ambra < LOW_AMBRA_THRESHOLD) out.push('hungry');
  if (state.stats.security < GAP_SUMMARY.lonelySecurity) out.push('lonely');
  if (state.asleep) out.push('asleep');
  return out;
}

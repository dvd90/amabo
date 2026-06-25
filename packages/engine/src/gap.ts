/**
 * gap.ts — PURE. Turns a before/after pair of states (plus the gap's events) into a
 * few factual highlights for the "while you were away" reveal (STORY.md §2). The engine
 * only says *what* changed in the dark — stage climbs, souring, illness, a dim or lonely
 * return; the AI layer still owns the creature's voice. No I/O, no clock read.
 */

import { STAGES, type Stage } from '@amabo/shared';
import { GAP_SUMMARY, LOW_AMBRA_THRESHOLD, MS_PER_MINUTE } from './config.js';
import type { CreatureState, SimEvent, Stats } from './state.js';

/** Ordered, factual things that happened while the Light was away. */
export type GapHighlight =
  | 'graduated'
  | 'grew'
  | 'brightened'
  | 'soured'
  | 'recovered'
  | 'fellIll'
  | 'rested'
  | 'content'
  | 'hungry'
  | 'lonely';

export interface GapSummary {
  /** Minutes the Light was away (clamped at 0). */
  elapsedMinutes: number;
  fromStage: Stage;
  toStage: Stage;
  /** What changed, most significant first. The UI maps these to copy + glyph. */
  highlights: GapHighlight[];
  /** Per-stat change over the gap, rounded; only moves past the noise floor appear. */
  deltas: Partial<Record<keyof Stats, number>>;
}

const stageIndex = (s: Stage): number => STAGES.indexOf(s);

export function summarizeGap(
  before: CreatureState,
  after: CreatureState,
  events: SimEvent[],
  elapsedMs: number,
): GapSummary {
  const highlights: GapHighlight[] = [];

  // Lifecycle headline: ascension outranks (and stands in for) a stage climb.
  const graduated = events.some((e) => e.kind === 'graduation');
  if (graduated) highlights.push('graduated');
  else if (stageIndex(after.stage) > stageIndex(before.stage)) highlights.push('grew');

  // The moral axis — crossed into longing, or was loved back toward the light.
  if (!before.uncanny && after.uncanny) highlights.push('soured');
  else if (before.uncanny && !after.uncanny) highlights.push('brightened');

  // Body.
  if (!before.ill && after.ill) highlights.push('fellIll');
  else if (before.ill && !after.ill) highlights.push('recovered');

  if (after.asleep && after.stats.energy >= before.stats.energy) highlights.push('rested');

  const hungry = after.stats.ambra < LOW_AMBRA_THRESHOLD;
  const lonely = after.stats.security < GAP_SUMMARY.lonelySecurity;

  // The quiet thesis: healthy, secure, bonded → "okay alone in the dark."
  const negative = after.uncanny || after.ill || hungry || lonely;
  if (!graduated && !negative && after.stats.affection >= GAP_SUMMARY.contentAffection) {
    highlights.push('content');
  }
  if (hungry) highlights.push('hungry');
  if (lonely) highlights.push('lonely');

  const deltas: Partial<Record<keyof Stats, number>> = {};
  (Object.keys(before.stats) as (keyof Stats)[]).forEach((k) => {
    const d = Math.round(after.stats[k] - before.stats[k]);
    if (Math.abs(d) >= GAP_SUMMARY.deltaNoiseFloor) deltas[k] = d;
  });

  return {
    elapsedMinutes: Math.max(0, Math.round(elapsedMs / MS_PER_MINUTE)),
    fromStage: before.stage,
    toStage: after.stage,
    highlights,
    deltas,
  };
}

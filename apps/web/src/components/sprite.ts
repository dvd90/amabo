/**
 * sprite.ts — the polymorphic creature glyph: stage × disposition (STORY.md §10 map).
 * Amabo presentations are warm and rounded; Yim presentations are uncanny (oversized
 * eyes, a stopped-clock stillness). A real dot-matrix sprite sheet replaces these
 * glyphs later; the mapping is what matters here.
 */

import type { CreatureViewT } from '@amabo/shared';

export function spriteFor(creature: CreatureViewT): string {
  const { stage, uncanny, asleep, alive } = creature.state;
  if (!alive) return '·';
  if (asleep) return 'z';
  if (uncanny) {
    // The Amabo's own face gone slightly wrong.
    return { mote: '◦', spark: '◌', velveteen: '◍', bloom: '◉' }[stage] ?? '◉';
  }
  return { mote: '∘', spark: '○', velveteen: '❍', bloom: '✿' }[stage] ?? '✿';
}

/** Amber LCD glow intensity (0..1) from ambient Ambra. */
export function glow(creature: CreatureViewT): number {
  return Math.max(0, Math.min(1, creature.state.stats.ambra / 100));
}

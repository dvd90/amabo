/**
 * events.ts — the weighted ambient event table (ARCHITECTURE.md §4.2 step 5). Each
 * sim-step has a small chance of a flavor moment the AI later narrates. M2 ships the
 * neutral table; M3 splits it into Amabo-leaning (warm finds) and Yim-leaning
 * (stopped-clock) tables keyed by disposition.
 */

export interface AmbientDef {
  /** A small motif the narration layer turns into a line (STORY.md §9, §11). */
  tag: string;
  weight: number;
  salience: number;
}

/** Disposition-neutral flavor — quiet, ordinary moments in the glass. */
export const AMBIENT_NEUTRAL: readonly AmbientDef[] = [
  { tag: 'warmSpot', weight: 3, salience: 1 },
  { tag: 'driftingLight', weight: 2, salience: 1 },
  { tag: 'triedAShape', weight: 2, salience: 1 },
  { tag: 'quietHour', weight: 1, salience: 1 },
];

/** Amabo-leaning — warm finds, soft gold, becoming rounder/Real (STORY.md §4, §9). */
export const AMBIENT_AMABO: readonly AmbientDef[] = [
  { tag: 'goldHour', weight: 3, salience: 1 },
  { tag: 'rounderShape', weight: 2, salience: 1 },
  { tag: 'practisedWaiting', weight: 2, salience: 1 },
  { tag: 'warmSpot', weight: 1, salience: 1 },
];

/** Yim-leaning — stopped clocks, the raven, a kept light, "nevermore" (STORY.md §4, §11). */
export const AMBIENT_YIM: readonly AmbientDef[] = [
  { tag: 'stoppedClock', weight: 3, salience: 2 },
  { tag: 'keptLight', weight: 2, salience: 2 },
  { tag: 'theRaven', weight: 2, salience: 2 },
  { tag: 'nevermore', weight: 1, salience: 2 },
];

/**
 * Choose the ambient table for a disposition: a soured Yim lives among stopped
 * clocks, a radiant Amabo among warm finds, and the in-between keeps neutral days.
 */
export function ambientTableFor(
  disposition: number,
  yimAtOrBelow: number,
  amaboAtOrAbove: number,
): readonly AmbientDef[] {
  if (disposition <= yimAtOrBelow) return AMBIENT_YIM;
  if (disposition >= amaboAtOrAbove) return AMBIENT_AMABO;
  return AMBIENT_NEUTRAL;
}

/** Pick one entry by weight. `r01` is a roll in [0, 1). */
export function pickWeighted(items: readonly AmbientDef[], r01: number): AmbientDef {
  const total = items.reduce((sum, it) => sum + it.weight, 0);
  let x = r01 * total;
  for (let i = 0; i < items.length - 1; i++) {
    const it = items[i]!;
    x -= it.weight;
    if (x < 0) return it;
  }
  return items[items.length - 1]!;
}

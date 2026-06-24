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

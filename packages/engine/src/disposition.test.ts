import { describe, expect, it } from 'vitest';
import { SECURE_ENOUGH, SIM_STEP_MS, UNCANNY_THRESHOLD } from './config.js';
import { advance } from './advance.js';
import { interact } from './interact.js';
import { condenseMote, type CreatureState } from './state.js';

describe('disposition — the moral engine (M3)', () => {
  it('sustained neglect sours a creature into a Yim', () => {
    const { state } = advance(condenseMote(3, 0), 4000 * SIM_STEP_MS);
    expect(state.disposition).toBeLessThan(UNCANNY_THRESHOLD);
    expect(state.uncanny).toBe(true);
    expect(state.disposition).toBeGreaterThanOrEqual(-100);
  });

  it('care that lands drifts a thriving creature toward Amabo (+)', () => {
    const radiant: CreatureState = {
      ...condenseMote(3, 0),
      stats: { ...condenseMote(3, 0).stats, ambra: 95, affection: 95, security: 95 },
    };
    const { state } = advance(radiant, 20 * SIM_STEP_MS);
    expect(state.disposition).toBeGreaterThan(0);
  });

  it('comfort is the redemption lever: a Yim can be loved back toward the light', () => {
    let s: CreatureState = { ...condenseMote(3, 1000), disposition: -50, uncanny: true };
    // A caring Light comforts while the creature needs it — and stops at peace.
    for (let i = 0; i < 12 && s.stats.security < SECURE_ENOUGH; i++) {
      s = interact(s, 'comfort').state;
    }
    expect(s.disposition).toBeGreaterThan(-50);
    expect(s.uncanny).toBe(false); // the door back is never locked
    // …but one sitting is bounded: at peace, the lever closes (no infinite pump).
    expect(interact(s, 'comfort').events[0]?.kind).toBe('refused');
  });

  it('a single act of care nudges disposition; over-care sours it', () => {
    const base = condenseMote(3, 1000);
    expect(interact(base, 'feed').state.disposition).toBeGreaterThan(0);
    expect(interact(base, 'play').state.disposition).toBeGreaterThan(0);

    const full: CreatureState = { ...base, stats: { ...base.stats, ambra: 99 } };
    expect(interact(full, 'feed').state.disposition).toBeLessThan(0); // refused
  });

  it('disposition stays within [-100, 100]', () => {
    // Cannot exceed +100 no matter how much comfort.
    let s: CreatureState = { ...condenseMote(3, 1000), disposition: 98 };
    s = interact(s, 'comfort').state;
    s = interact(s, 'comfort').state;
    expect(s.disposition).toBe(100);

    // Cannot fall below −100 no matter how long the dark.
    const { state } = advance(condenseMote(3, 0), 50_000 * SIM_STEP_MS);
    expect(state.disposition).toBe(-100);
  });

  it('a soured creature draws Yim-leaning ambient motifs', () => {
    const { events } = advance(condenseMote(5, 0), 6000 * SIM_STEP_MS);
    const tags = new Set(events.filter((e) => e.kind === 'ambient').map((e) => e.tag));
    const yimMotifs = ['stoppedClock', 'keptLight', 'theRaven', 'nevermore'];
    expect(yimMotifs.some((t) => tags.has(t))).toBe(true);
  });
});

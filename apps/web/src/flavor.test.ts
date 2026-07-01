import type { CreatureViewT } from '@amabo/shared';
import { describe, expect, it } from 'vitest';
import { elderLine, todayLine } from './flavor.js';

function view(over: Partial<CreatureViewT['state']> = {}): CreatureViewT {
  return {
    id: 'c1',
    name: 'Pip',
    graduatedAt: null,
    archivedAt: null,
    lastSeenAt: null,
    createdAt: 0,
    state: {
      seed: 7,
      stage: 'mote',
      disposition: 0,
      ageMinutes: 0,
      stats: { ambra: 70, energy: 80, cleanliness: 100, health: 100, affection: 50, security: 50 },
      asleep: false,
      ill: false,
      uncanny: false,
      alive: true,
      mortality: 'soft',
      traits: {},
      careHistory: { fed: 0, cleaned: 0, played: 0, comforted: 0, neglectedSteps: 0 },
      lastTickAt: 0,
      ...over,
    },
  };
}

const DAY = 86_400_000;

describe('flavor — daily "today" + the Skin Horse (M-I)', () => {
  it('is stable within a day and may change across days', () => {
    const c = view();
    expect(todayLine(c, 5 * DAY)).toBe(todayLine(c, 5 * DAY + 1000));
    const lines = new Set([0, 1, 2, 3, 4, 5, 6].map((d) => todayLine(c, d * DAY)));
    expect(lines.size).toBeGreaterThan(1); // it does vary over a week
  });

  it('an Amabo and a Yim draw from different registers', () => {
    // A Yim line mentions its time-broken motifs; an Amabo line is warm.
    const yim = todayLine(view({ uncanny: true }), 3 * DAY);
    expect(yim).toMatch(/clock|bird|hour|light it does not have|your shape/);
  });

  it('the Skin Horse only counsels the young, and only some days', () => {
    // Bloom is never counselled.
    const bloom = view({ stage: 'bloom' });
    expect([0, 1, 2, 3, 4].every((d) => elderLine(bloom, d * DAY) === null)).toBe(true);
    // A Mote hears it at least once across a week.
    const mote = view({ stage: 'mote' });
    const heard = [0, 1, 2, 3, 4, 5, 6].some((d) => elderLine(mote, d * DAY) !== null);
    expect(heard).toBe(true);
  });
});

import { describe, expect, it } from 'vitest';
import { AMABO_THRESHOLD, DAYPATH, UNCANNY_THRESHOLD } from './config.js';
import {
  DAYPATHS_AMABO,
  DAYPATHS_NEUTRAL,
  DAYPATHS_YIM,
  applyDaypath,
  dealDaypaths,
} from './daypath.js';
import { mulberry32 } from './rng.js';
import { condenseMote } from './state.js';

const T0 = Date.parse('2026-07-04T10:00:00Z');
const LONG_AWAY = DAYPATH.minAbsenceMs + 1;

function mote(disposition = 0) {
  const s = condenseMote(7, T0);
  return { ...s, disposition };
}

describe('the Little World (STORY.md §8¾) — the glass deals, the soul picks', () => {
  it('deals distinct, register-appropriate options after a long absence', () => {
    const dealt = dealDaypaths(mote(0), LONG_AWAY, mulberry32(1));
    expect(dealt).toHaveLength(DAYPATH.options);
    expect(new Set(dealt.map((o) => o.id)).size).toBe(DAYPATH.options);
    for (const o of dealt) expect(DAYPATHS_NEUTRAL.some((d) => d.id === o.id)).toBe(true);

    const warm = dealDaypaths(mote(AMABO_THRESHOLD), LONG_AWAY, mulberry32(1));
    for (const o of warm) expect(DAYPATHS_AMABO.some((d) => d.id === o.id)).toBe(true);

    const soured = dealDaypaths(mote(UNCANNY_THRESHOLD - 1), LONG_AWAY, mulberry32(1));
    for (const o of soured) expect(DAYPATHS_YIM.some((d) => d.id === o.id)).toBe(true);
  });

  it('is deterministic: the same seed deals the same hand', () => {
    const a = dealDaypaths(mote(0), LONG_AWAY, mulberry32(42));
    const b = dealDaypaths(mote(0), LONG_AWAY, mulberry32(42));
    expect(a).toEqual(b);
  });

  it('deals nothing for a short absence or an ended light', () => {
    expect(dealDaypaths(mote(0), DAYPATH.minAbsenceMs - 1, mulberry32(1))).toEqual([]);
    const gone = { ...mote(0), alive: false };
    expect(dealDaypaths(gone, LONG_AWAY, mulberry32(1))).toEqual([]);
  });

  it('applyDaypath records a pure flavor event — never fate', () => {
    const state = mote(0);
    const dealt = dealDaypaths(state, LONG_AWAY, mulberry32(1));
    const event = applyDaypath(dealt, dealt[1]!.id, T0);
    expect(event.kind).toBe('daypath');
    expect(event.tag).toBe(dealt[1]!.tag);
    expect(event.at).toBe(T0);
    // The dealer's law: choosing can never touch the stats or the heart.
    expect(event.statDeltas).toEqual({});
    expect(event.dispositionDelta).toBe(0);
  });

  it('a soul that answers nonsense gets the first-dealt path', () => {
    const dealt = dealDaypaths(mote(0), LONG_AWAY, mulberry32(1));
    const event = applyDaypath(dealt, 'give-me-all-the-ambra', T0);
    expect(event.tag).toBe(dealt[0]!.tag);
  });
});

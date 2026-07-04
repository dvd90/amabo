import { describe, expect, it } from 'vitest';
import { CHRONICLE, TEMPER_KEYS } from './config.js';
import {
  ENCOUNTER_TAGS_STRAINED,
  ENCOUNTER_TAGS_WARM,
  bondDeltaFor,
  rollEncounters,
  temperOf,
} from './chronicle.js';
import { mulberry32 } from './rng.js';
import { condenseMote } from './state.js';

const T0 = Date.parse('2026-07-04T10:00:00Z');
const LONG = CHRONICLE.minGapMs + 1;

function member(id: string, seed: number, disposition = 0) {
  return { id, state: { ...condenseMote(seed, T0), disposition } };
}

describe('the Chronicle (STORY.md §8⅞) — tempers and encounters, pure', () => {
  it('a newborn is dealt a temper: all keys present, in range, seeded-deterministic', () => {
    const a = condenseMote(7, T0);
    for (const k of TEMPER_KEYS) {
      expect(a.traits[k]).toBeGreaterThanOrEqual(0);
      expect(a.traits[k]).toBeLessThanOrEqual(100);
    }
    expect(condenseMote(7, T0).traits).toEqual(a.traits); // same seed, same temper
    expect(condenseMote(8, T0).traits).not.toEqual(a.traits); // its own leanings
    // Older creatures condensed before tempers existed read as even-keeled (50).
    expect(temperOf({ ...a, traits: {} }, 'jealousy')).toBe(50);
  });

  it('rolls encounters for a company left long in the dark — deterministic, capped', () => {
    const members = [member('a', 1), member('b', 2), member('c', 3)];
    const out = rollEncounters(members, LONG, mulberry32(42));
    expect(out).toEqual(rollEncounters(members, LONG, mulberry32(42)));
    expect(out.length).toBeLessThanOrEqual(CHRONICLE.maxPerGap);
    for (const e of out) {
      expect(e.aId).not.toBe(e.bId);
      expect(['warm', 'strained']).toContain(e.valence);
      const pool = e.valence === 'warm' ? ENCOUNTER_TAGS_WARM : ENCOUNTER_TAGS_STRAINED;
      expect(pool).toContain(e.tag);
    }
  });

  it('asks nothing of a short gap, a lone light, or the ended', () => {
    const members = [member('a', 1), member('b', 2)];
    expect(rollEncounters(members, CHRONICLE.minGapMs - 1, mulberry32(1))).toEqual([]);
    expect(rollEncounters([member('a', 1)], LONG, mulberry32(1))).toEqual([]);
    const gone = { id: 'g', state: { ...condenseMote(9, T0), alive: false } };
    expect(rollEncounters([member('a', 1), gone], LONG, mulberry32(1))).toEqual([]);
  });

  it('hearts far apart strain; close hearts mostly warm (over many rolls)', () => {
    const close = [member('a', 1, 40), member('b', 2, 45)];
    const far = [member('a', 1, 80), member('b', 2, -60)];
    let warmClose = 0;
    let warmFar = 0;
    let nClose = 0;
    let nFar = 0;
    for (let s = 0; s < 200; s++) {
      for (const e of rollEncounters(close, LONG, mulberry32(s))) {
        nClose++;
        if (e.valence === 'warm') warmClose++;
      }
      for (const e of rollEncounters(far, LONG, mulberry32(s))) {
        nFar++;
        if (e.valence === 'warm') warmFar++;
      }
    }
    expect(nClose).toBeGreaterThan(10); // company meets
    expect(warmClose / nClose).toBeGreaterThan(warmFar / nFar); // distance strains
  });

  it('even a strain leaves a thread — and a smaller one (bond, never stats)', () => {
    expect(bondDeltaFor('warm')).toBeGreaterThan(bondDeltaFor('strained'));
    expect(bondDeltaFor('strained')).toBeGreaterThan(0);
  });
});

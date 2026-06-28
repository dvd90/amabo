import { describe, expect, it } from 'vitest';
import { condenseMote, type CreatureState, type SimEvent } from '@amabo/engine';
import { localNarrator } from './local.js';

function state(over: Partial<CreatureState> = {}): CreatureState {
  return { ...condenseMote(1, 0), ...over };
}

function ev(kind: SimEvent['kind'], over: Partial<SimEvent> = {}): SimEvent {
  return { at: 0, kind, statDeltas: {}, dispositionDelta: 0, salience: 1, ...over };
}

const say = async (s: CreatureState, events: SimEvent[] = []) =>
  (await localNarrator.narrate({ name: 'Pip', state: s }, events, 'peek')).journal;

const FORBIDDEN = /\b(player|user|click|tap the|button|XP|points|stat|level up)\b/i;
const sentences = (s: string) => (s.match(/[.!?]/g) ?? []).length;

describe('the local peek narrator (the keyless diary)', () => {
  it('is varied: a content creature does not repeat the same line every peek', async () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 40; seed++) {
      // vary seed + age so successive peeks roll differently
      seen.add(await say(state({ seed, ageMinutes: seed * 17, disposition: 60 })));
    }
    expect(seen.size).toBeGreaterThan(5);
  });

  it('is pure & deterministic: same inputs → same entry', async () => {
    const s = state({ seed: 9, ageMinutes: 120, disposition: 50 });
    const a = await localNarrator.narrate({ name: 'Pip', state: s }, [ev('ambient')], 'peek');
    const b = await localNarrator.narrate({ name: 'Pip', state: s }, [ev('ambient')], 'peek');
    expect(a).toEqual(b);
  });

  it('reads the events: the dominant condition of the gap picks the register', async () => {
    // grew → "becoming"; mentions a real change, not the content baseline
    const grew = await localNarrator.narrate(
      { name: 'Pip', state: state({ stage: 'velveteen' }) },
      [ev('evolved', { salience: 4 })],
      'milestone',
    );
    expect(grew.mood).toBe('becoming');
    expect(grew.newMemories?.length).toBeGreaterThan(0); // the day is remembered

    // ascended → luminous, valedictory
    const grad = await localNarrator.narrate(
      { name: 'Pip', state: state() },
      [ev('graduation', { salience: 6 })],
      'milestone',
    );
    expect(grad.mood).toBe('radiant');

    // fell ill → dim
    expect(
      (await localNarrator.narrate({ name: 'Pip', state: state({ ill: true }) }, [], 'peek')).mood,
    ).toBe('dim');
  });

  it('separates the two souls: a Yim longs; a warmed Yim thaws', async () => {
    const yim = await localNarrator.narrate(
      { name: 'Pip', state: state({ disposition: -60, uncanny: true }) },
      [ev('ambient', { tag: 'stoppedClock' })],
      'peek',
    );
    expect(yim.mood).toBe('longing');

    // a Yim drawn back toward the light (positive disposition drift) reads as redemption
    const warmed = await localNarrator.narrate(
      { name: 'Pip', state: state({ disposition: -40, uncanny: true }) },
      [ev('recovered', { dispositionDelta: 3 }), ev('ambient', { dispositionDelta: 2 })],
      'peek',
    );
    expect(['thawing', 'mending']).toContain(warmed.mood);
  });

  it('a creature whose light went out falls quiet', async () => {
    const dead = await say(state({ alive: false }));
    expect(dead.toLowerCase()).toContain('quiet');
  });

  it('never breaks the voice rules, and stays diary-short (≤ 3 sentences)', async () => {
    const samples = [
      state({ disposition: 70 }),
      state({ disposition: -70, uncanny: true }),
      state({ ill: true }),
      state({ asleep: true }),
      state({ stats: { ...state().stats, security: 10, affection: 10 } }),
      state({ stats: { ...state().stats, ambra: 10, energy: 10 } }),
      state({ alive: false }),
    ];
    for (let seed = 1; seed <= 12; seed++) {
      for (const base of samples) {
        const j = await say({ ...base, seed, ageMinutes: seed * 13 });
        expect(j).not.toMatch(FORBIDDEN);
        expect(sentences(j)).toBeLessThanOrEqual(3);
        expect(j.length).toBeLessThan(240);
      }
    }
  });
});

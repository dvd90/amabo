import { describe, expect, it } from 'vitest';
import { FULL_AMBRA, PLAY_ENERGY_FLOOR } from './config.js';
import { interact } from './interact.js';
import { condenseMote, type CreatureState } from './state.js';

const fresh = () => condenseMote(1, 1000);

describe('interact — care actions (M2)', () => {
  it('feed raises Ambra and records the care', () => {
    const { state, events } = interact(fresh(), 'feed');
    expect(state.stats.ambra).toBeGreaterThan(70);
    expect(state.careHistory.fed).toBe(1);
    expect(events[0]?.kind).toBe('fed');
    expect(events[0]?.at).toBe(1000);
  });

  it('feeding a full creature is refused and costs affection (over-care stings)', () => {
    const full: CreatureState = { ...fresh(), stats: { ...fresh().stats, ambra: FULL_AMBRA + 5 } };
    const { state, events } = interact(full, 'feed');
    expect(state.stats.affection).toBeLessThan(full.stats.affection);
    expect(state.careHistory.fed).toBe(0);
    expect(events[0]?.kind).toBe('refused');
  });

  it('clean restores cleanliness', () => {
    const dirty: CreatureState = { ...fresh(), stats: { ...fresh().stats, cleanliness: 10 } };
    const { state, events } = interact(dirty, 'clean');
    expect(state.stats.cleanliness).toBeGreaterThan(10);
    expect(state.careHistory.cleaned).toBe(1);
    expect(events[0]?.kind).toBe('cleaned');
  });

  it('play spends energy and deepens the bond', () => {
    const { state, events } = interact(fresh(), 'play');
    expect(state.stats.energy).toBeLessThan(80);
    expect(state.stats.affection).toBeGreaterThan(50);
    expect(state.careHistory.played).toBe(1);
    expect(events[0]?.kind).toBe('played');
  });

  it('a too-tired creature cannot play', () => {
    const tired: CreatureState = {
      ...fresh(),
      stats: { ...fresh().stats, energy: PLAY_ENERGY_FLOOR - 1 },
    };
    const { state, events } = interact(tired, 'play');
    expect(state.careHistory.played).toBe(0);
    expect(events[0]?.kind).toBe('tooTired');
  });

  it('comfort restores security and affection (the redemption lever)', () => {
    const low: CreatureState = { ...fresh(), stats: { ...fresh().stats, security: 20 } };
    const { state, events } = interact(low, 'comfort');
    expect(state.stats.security).toBeGreaterThan(20);
    expect(state.careHistory.comforted).toBe(1);
    expect(events[0]?.kind).toBe('comforted');
  });

  it('sleep and wake toggle rest, emitting transitions only on a real change', () => {
    const slept = interact(fresh(), 'sleep');
    expect(slept.state.asleep).toBe(true);
    expect(slept.events[0]?.kind).toBe('fellAsleep');

    // Already asleep → no-op, no event.
    expect(interact(slept.state, 'sleep').events).toEqual([]);

    const woke = interact(slept.state, 'wake');
    expect(woke.state.asleep).toBe(false);
    expect(woke.events[0]?.kind).toBe('woke');

    // Already awake → no-op.
    expect(interact(woke.state, 'wake').events).toEqual([]);
  });

  it('a creature whose light has gone out cannot be interacted with', () => {
    const dead: CreatureState = { ...fresh(), alive: false };
    const r = interact(dead, 'feed');
    expect(r.state).toBe(dead);
    expect(r.events).toEqual([]);
  });
});

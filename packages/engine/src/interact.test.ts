import { describe, expect, it } from 'vitest';
import { CLEAN_ENOUGH, FULL_AMBRA, PLAY_ENERGY_FLOOR, SECURE_ENOUGH } from './config.js';
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

  it('cleaning an already-clean creature is refused (over-care stings everywhere)', () => {
    const spotless: CreatureState = {
      ...fresh(),
      stats: { ...fresh().stats, cleanliness: CLEAN_ENOUGH + 5 },
    };
    const { state, events } = interact(spotless, 'clean');
    expect(events[0]?.kind).toBe('refused');
    expect(state.careHistory.cleaned).toBe(0);
    expect(state.stats.affection).toBeLessThan(spotless.stats.affection);
    expect(state.disposition).toBeLessThan(spotless.disposition);
  });

  it('comforting a creature already at peace is refused — the lever is for need', () => {
    const atPeace: CreatureState = {
      ...fresh(),
      stats: { ...fresh().stats, security: SECURE_ENOUGH + 5 },
    };
    const { state, events } = interact(atPeace, 'comfort');
    expect(events[0]?.kind).toBe('refused');
    expect(state.careHistory.comforted).toBe(0);
    expect(state.disposition).toBeLessThan(atPeace.disposition);
  });

  it('spamming comfort cannot pump disposition forever: it self-seals into refusals', () => {
    // Each landed comfort raises security; once security crosses SECURE_ENOUGH the
    // next spam is refused and *costs* disposition — closing the +6/act exploit.
    let s = fresh();
    let refused = false;
    for (let i = 0; i < 10; i++) {
      const r = interact(s, 'comfort');
      if (r.events[0]?.kind === 'refused') {
        refused = true;
        break;
      }
      s = r.state;
    }
    expect(refused).toBe(true);
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

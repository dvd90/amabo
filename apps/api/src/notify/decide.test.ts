import { condenseMote, type CreatureState } from '@amabo/engine';
import { describe, expect, it } from 'vitest';
import { decideNotification, MISS_MS, NOTIFY_COOLDOWN_MS, type NotifyCandidate } from './decide.js';

function cand(
  over: Partial<CreatureState>,
  lastSeenAt: number | null = 0,
  name = 'Pip',
): NotifyCandidate {
  return { name, lastSeenAt, state: { ...condenseMote(1, 0), ...over } };
}
function withStats(c: NotifyCandidate, over: Partial<CreatureState['stats']>): NotifyCandidate {
  return { ...c, state: { ...c.state, stats: { ...c.state.stats, ...over } } };
}

const NOW = 10 * MISS_MS;

describe('decideNotification (M-C)', () => {
  it('stays silent inside the cooldown window', () => {
    const ill = cand({ ill: true });
    expect(decideNotification([ill], NOW, NOW - 1000)).toBeNull();
  });

  it('pings about an unwell creature', () => {
    const msg = decideNotification([cand({ ill: true })], NOW, null);
    expect(msg?.title).toMatch(/isn't feeling well/);
  });

  it('prioritises illness over a low Ambra', () => {
    const hungry = withStats(cand({}, 0, 'Bo'), { ambra: 10 });
    const ill = cand({ ill: true }, 0, 'Pip');
    const msg = decideNotification([hungry, ill], NOW, null);
    expect(msg?.title).toContain('Pip'); // the ill one wins
  });

  it('nudges when a creature has been alone in the dark a long while', () => {
    const lonelyAway = withStats(cand({}, NOW - MISS_MS - 1), { security: 40 });
    const msg = decideNotification([lonelyAway], NOW, null);
    expect(msg?.title).toMatch(/misses the Light/);
  });

  it('says nothing when all is well and recently seen', () => {
    const happy = withStats(cand({}, NOW - 1000), { ambra: 80, security: 80, affection: 80 });
    expect(decideNotification([happy], NOW, null)).toBeNull();
  });

  it('respects an explicit cooldown override', () => {
    const ill = cand({ ill: true });
    expect(decideNotification([ill], NOW, NOW - 1000, NOTIFY_COOLDOWN_MS)).toBeNull();
    expect(decideNotification([ill], NOW, NOW - NOTIFY_COOLDOWN_MS - 1)).not.toBeNull();
  });
});

describe('social pushes (M-M) — the world writes while they sleep', () => {
  const calm = (name: string): NotifyCandidate => ({
    name,
    state: { ...condenseMote(1, 0), stats: { ...condenseMote(1, 0).stats, security: 80 } },
    lastSeenAt: 0,
  });

  it('with nothing urgent, a fresh Chronicle page becomes the ping — in the shelf\u2019s words', () => {
    const msg = decideNotification([calm('Pip')], NOW, null, NOTIFY_COOLDOWN_MS, {
      aName: 'Vel',
      bName: 'Mo',
      valence: 'strained',
      text: 'Vel and Mo both wanted the same warm corner, and neither would say so.',
    });
    expect(msg?.title).toBe('Vel & Mo met while you were away');
    expect(msg?.body).toContain('warm corner');
  });

  it('urgent needs still outrank the gossip', () => {
    const ill: NotifyCandidate = {
      name: 'Pip',
      state: { ...condenseMote(1, 0), ill: true },
      lastSeenAt: 0,
    };
    const msg = decideNotification([ill], NOW, null, NOTIFY_COOLDOWN_MS, {
      aName: 'Vel',
      bName: 'Mo',
      valence: 'warm',
      text: 'x',
    });
    expect(msg?.title).toMatch(/isn't feeling well/);
  });

  it('no social candidate, nothing urgent, nobody lonely → still silence', () => {
    expect(decideNotification([calm('Pip')], NOW, null)).toBeNull();
  });
});

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

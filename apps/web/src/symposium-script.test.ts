import { describe, expect, it } from 'vitest';
import { buildScript, beatDuration } from './symposium-script.js';
import type { GatheringView } from './api/client.js';

const g: GatheringView = {
  id: 'g1',
  at: 0,
  participants: [
    { id: 'c1', name: 'Pip', stage: 'bloom', uncanny: false },
    { id: 'c2', name: 'Bo', stage: 'spark', uncanny: true },
  ],
  connections: [{ a: 'c1', b: 'c2', kind: 'harmony' }],
  moments: [],
  outcomes: [
    { id: 'c1', warmed: false, comfortedById: null, bondedWith: ['c2'] },
    { id: 'c2', warmed: true, comfortedById: 'c1', bondedWith: ['c1'] },
  ],
  transcript: [
    { speaker: '', text: 'The glade filled with light.' },
    { speaker: 'Pip', text: 'Love is attention that found somewhere to land.' },
  ],
};

describe('buildScript (the Symposium beats)', () => {
  it('plays the conversation, then the resonance, then a toast', () => {
    const beats = buildScript(g);
    expect(beats[0]).toEqual({ kind: 'dir', text: 'The glade filled with light.' });
    expect(beats[1]).toEqual({
      kind: 'say',
      speakerId: 'c1',
      speaker: 'Pip',
      text: 'Love is attention that found somewhere to land.',
    });
    expect(beats).toContainEqual({ kind: 'spark', a: 'c1', b: 'c2' });
    expect(beats).toContainEqual({ kind: 'warm', who: 'c2', by: 'c1' });
    expect(beats.at(-1)).toEqual({ kind: 'toast' });
  });

  it('gives each beat a positive on-screen duration', () => {
    for (const b of buildScript(g)) expect(beatDuration(b)).toBeGreaterThan(0);
  });
});

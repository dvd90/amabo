import type { CreatureViewT } from '@amabo/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ApiClient } from '../api/client.js';
import { SCREENS, useGame } from './useGame.js';

function creature(over: Partial<CreatureViewT['state']> = {}): CreatureViewT {
  return {
    id: 'c1',
    name: 'Pip',
    graduatedAt: null,
    createdAt: 0,
    state: {
      seed: 1,
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

function fakeClient(): ApiClient {
  return {
    me: vi.fn().mockResolvedValue({ user: { id: 'u1', displayName: 'P' } }),
    createCreature: vi.fn().mockResolvedValue(creature()),
    getCreature: vi.fn().mockResolvedValue(creature()),
    peek: vi
      .fn()
      .mockResolvedValue({ journal: 'soft gold day', mood: 'content', creature: creature() }),
    interact: vi.fn().mockResolvedValue({
      creature: creature({
        stats: {
          ambra: 88,
          energy: 84,
          cleanliness: 100,
          health: 100,
          affection: 52,
          security: 50,
        },
      }),
      events: [{ kind: 'fed', statDeltas: { ambra: 18 } }],
    }),
    journal: vi
      .fn()
      .mockResolvedValue([{ at: 1, kind: 'fed', tag: null, text: null, salience: 2 }]),
    stars: vi.fn().mockResolvedValue([]),
  };
}

describe('useGame store (M8)', () => {
  beforeEach(() => {
    useGame.setState({
      creature: null,
      screen: 'home',
      lastJournal: null,
      mood: null,
      journalEntries: [],
      stars: [],
      busy: false,
      error: null,
    });
  });

  it('A cycles screens; C returns home', () => {
    const { next, back } = useGame.getState();
    next();
    expect(useGame.getState().screen).toBe(SCREENS[1]);
    back();
    expect(useGame.getState().screen).toBe('home');
  });

  it('condenses a Mote when confirming with no creature', async () => {
    const client = fakeClient();
    useGame.getState().setClient(client);
    await useGame.getState().confirm();
    expect(client.createCreature).toHaveBeenCalled();
    expect(useGame.getState().creature?.name).toBe('Pip');
  });

  it('feeds on the Feed screen, reflects the new state, and shows feedback', async () => {
    const client = fakeClient();
    useGame.setState({ client, creature: creature(), screen: 'feed', lastResult: null });
    await useGame.getState().confirm();
    expect(client.interact).toHaveBeenCalledWith('c1', 'feed');
    expect(useGame.getState().creature?.state.stats.ambra).toBe(88);
    // The "nothing happens" fix: a visible result line after care.
    expect(useGame.getState().lastResult).toContain('fed');
    expect(useGame.getState().lastResult).toContain('ambra ↑');
  });

  it('surfaces an error instead of failing silently', async () => {
    const client = fakeClient();
    (client.interact as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('POST /creatures/c1/interact → 403'),
    );
    useGame.setState({ client, creature: creature(), screen: 'feed', error: null });
    await useGame.getState().confirm();
    expect(useGame.getState().error).toBeTruthy();
  });

  it('peeks on Home and shows the away-journal line', async () => {
    const client = fakeClient();
    useGame.setState({ client, creature: creature(), screen: 'home' });
    await useGame.getState().confirm();
    expect(client.peek).toHaveBeenCalled();
    expect(useGame.getState().lastJournal).toBe('soft gold day');
  });

  it('toggles sleep from the Lights screen', async () => {
    const client = fakeClient();
    useGame.setState({ client, creature: creature(), screen: 'lights' });
    await useGame.getState().confirm();
    expect(client.interact).toHaveBeenCalledWith('c1', 'sleep');
  });

  it('debounces peek — a second call within the window keeps the cached line (M9)', async () => {
    const client = fakeClient();
    useGame.setState({ client, creature: creature(), lastPeekAt: 0, lastJournal: null });
    await useGame.getState().peek();
    await useGame.getState().peek();
    expect(client.peek).toHaveBeenCalledTimes(1);
    expect(useGame.getState().lastJournal).toBe('soft gold day');
  });

  it('mute and high-contrast toggles flip state (M9 a11y)', () => {
    useGame.getState().toggleMute();
    expect(useGame.getState().muted).toBe(true);
    useGame.getState().toggleContrast();
    expect(useGame.getState().highContrast).toBe(true);
  });
});

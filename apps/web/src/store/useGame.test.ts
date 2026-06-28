import type { CreatureViewT } from '@amabo/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ApiClient } from '../api/client.js';
import { SCREENS, useGame } from './useGame.js';

function creature(over: Partial<CreatureViewT['state']> = {}): CreatureViewT {
  return {
    id: 'c1',
    name: 'Pip',
    graduatedAt: null,
    lastSeenAt: null,
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
    me: vi.fn().mockResolvedValue({ user: { id: 'u1', displayName: 'P' }, csrfToken: 'x' }),
    authConfig: vi.fn().mockResolvedValue({ email: true, google: false }),
    loginWithEmail: vi
      .fn()
      .mockResolvedValue({ user: { id: 'u1', displayName: 'P' }, csrfToken: 'x' }),
    logout: vi.fn().mockResolvedValue(undefined),
    listCreatures: vi.fn().mockResolvedValue([{ ...creature(), needs: [] }]),
    createCreature: vi.fn().mockResolvedValue(creature()),
    getCreature: vi.fn().mockResolvedValue({ ...creature(), needs: [] }),
    multiply: vi.fn().mockResolvedValue({
      parent: { ...creature(), needs: [] },
      child: { ...creature(), id: 'c2', name: 'Pip’s half', needs: [] },
    }),
    meet: vi.fn().mockResolvedValue({ result: 'harmony', names: ['Pip', 'Bo'] }),
    gather: vi.fn().mockResolvedValue({
      id: 'g1',
      at: 0,
      participants: [],
      connections: [],
      moments: [],
      outcomes: [],
      transcript: [],
    }),
    vapidKey: vi.fn().mockResolvedValue(null),
    subscribePush: vi.fn().mockResolvedValue(undefined),
    share: vi
      .fn()
      .mockResolvedValue({ token: 't', kind: 'postcard', url: 'https://x/look/t', expiresAt: 0 }),
    postcard: vi
      .fn()
      .mockResolvedValue({ name: 'Pip', stage: 'mote', uncanny: false, graduated: false }),
    rehome: vi.fn().mockResolvedValue(undefined),
    incomingRehomes: vi.fn().mockResolvedValue([]),
    acceptRehome: vi.fn().mockResolvedValue(undefined),
    peek: vi.fn().mockResolvedValue({
      journal: 'soft gold day',
      mood: 'content',
      creature: creature(),
      away: {
        elapsedMinutes: 120,
        fromStage: 'mote',
        toStage: 'mote',
        highlights: ['hungry'],
        deltas: { ambra: -20 },
      },
    }),
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
      needs: [],
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
      authed: null,
      creatures: [],
      incoming: [],
      creature: null,
      creatureNeeds: [],
      route: 'dashboard',
      screen: 'home',
      lastJournal: null,
      mood: null,
      reveal: null,
      graduation: null,
      journalEntries: [],
      stars: [],
      busy: false,
      error: null,
      emote: null,
      emoteNonce: 0,
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
    // …and the creature reacts (emote + a bumped nonce so the SVG animates).
    expect(useGame.getState().emote).toBe('feed');
    expect(useGame.getState().emoteNonce).toBeGreaterThan(0);
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

  it('loads the roster and opens a creature into the device view', async () => {
    const client = fakeClient();
    useGame.getState().setClient(client);
    await useGame.getState().loadDashboard();
    expect(client.listCreatures).toHaveBeenCalled();
    expect(useGame.getState().creatures).toHaveLength(1);

    await useGame.getState().openCreature('c1');
    // Opening peeks (so the away-recap can show) rather than a silent fetch.
    expect(client.peek).toHaveBeenCalledWith('c1');
    expect(useGame.getState().route).toBe('device');
    expect(useGame.getState().creature?.id).toBe('c1');
    expect(useGame.getState().lastJournal).toBe('soft gold day');
    expect(useGame.getState().reveal?.highlights).toContain('hungry');

    useGame.getState().dismissReveal();
    expect(useGame.getState().reveal).toBeNull();
  });

  it('starting a new Mote adds it to the roster and opens it', async () => {
    const client = fakeClient();
    useGame.setState({ client, creatures: [] });
    await useGame.getState().start('Pip');
    expect(useGame.getState().creatures.map((c) => c.name)).toContain('Pip');
    expect(useGame.getState().route).toBe('device');
  });

  it('a peek that returns an ascension triggers the graduation ceremony', async () => {
    const client = fakeClient();
    (client.peek as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      journal: 'into the light',
      mood: 'valedictory',
      creature: creature(),
      graduated: {
        id: 's1',
        name: 'Lumen',
        bornAt: 0,
        graduatedAt: 2 * 86_400_000,
        constellationPos: { x: 0.1, y: 0.2 },
      },
    });
    useGame.setState({ client, creature: creature(), screen: 'home', lastPeekAt: 0 });
    await useGame.getState().peek();
    expect(useGame.getState().graduation?.name).toBe('Lumen');

    await useGame.getState().dismissGraduation();
    expect(useGame.getState().graduation).toBeNull();
    expect(useGame.getState().route).toBe('dashboard');
  });

  it('multiply splits the creature and adds the new half to the roster', async () => {
    const client = fakeClient();
    // After the split, the authoritative roster (reloaded on return) holds both halves.
    (client.listCreatures as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      { ...creature(), needs: [] },
      { ...creature(), id: 'c2', name: 'Pip’s half', needs: [] },
    ]);
    useGame.setState({ client, creature: creature(), creatures: [{ ...creature(), needs: [] }] });
    await useGame.getState().multiply();
    expect(client.multiply).toHaveBeenCalledWith('c1');
    expect(useGame.getState().creatures.some((c) => c.id === 'c2')).toBe(true);
    expect(useGame.getState().route).toBe('dashboard');
  });

  it('introducing two creatures resonates them and reports the result', async () => {
    const client = fakeClient();
    useGame.setState({ client });
    const line = await useGame.getState().meet('c1', 'c2');
    expect(client.meet).toHaveBeenCalledWith('c1', 'c2');
    expect(line).toMatch(/harmonized/);
  });

  it('shareCreature mints a keepsake link for the open creature', async () => {
    const client = fakeClient();
    useGame.setState({ client, creature: creature() });
    const url = await useGame.getState().shareCreature();
    expect(client.share).toHaveBeenCalledWith('c1', 'postcard');
    expect(url).toMatch(/\/look\//);
  });

  it('rehome entrusts the open creature to an email', async () => {
    const client = fakeClient();
    useGame.setState({ client, creature: creature() });
    const line = await useGame.getState().rehome('friend@example.com');
    expect(client.rehome).toHaveBeenCalledWith('c1', 'friend@example.com');
    expect(line).toMatch(/entrusted to friend@example.com/);
  });

  it('accepting an incoming rehome confirms it and reloads the roster', async () => {
    const client = fakeClient();
    useGame.setState({ client });
    await useGame.getState().acceptRehome('r1');
    expect(client.acceptRehome).toHaveBeenCalledWith('r1');
    expect(client.listCreatures).toHaveBeenCalled(); // roster refreshed
  });

  it('sign out clears the session and routes back to the login screen', async () => {
    const client = fakeClient();
    useGame.setState({
      client,
      authed: true,
      creatures: [{ ...creature(), needs: [] }],
      creature: creature(),
      route: 'device',
    });
    await useGame.getState().signOut();
    expect(client.logout).toHaveBeenCalled();
    expect(useGame.getState().creature).toBeNull();
    expect(useGame.getState().route).toBe('dashboard');
    // The routing fix: authed flips false so <App> shows <Login>, not an empty dashboard.
    expect(useGame.getState().authed).toBe(false);
  });

  it('checkSession marks authed from an existing session and loads the roster', async () => {
    const client = fakeClient();
    useGame.setState({ client, authed: null });
    await useGame.getState().checkSession();
    expect(useGame.getState().authed).toBe(true);
    expect(useGame.getState().creatures).toHaveLength(1);
  });

  it('mute and high-contrast toggles flip state (M9 a11y)', () => {
    useGame.getState().toggleMute();
    expect(useGame.getState().muted).toBe(true);
    useGame.getState().toggleContrast();
    expect(useGame.getState().highContrast).toBe(true);
  });
});

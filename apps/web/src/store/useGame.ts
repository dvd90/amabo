/**
 * store/useGame.ts — the device's client state (Zustand). Mirrors server state and
 * runs the button-driven screen machine. The API client is injectable so the store is
 * unit-testable without a network.
 */

import { create } from 'zustand';
import {
  HttpApiClient,
  type ApiClient,
  type CareAction,
  type CreatureViewT,
  type GapSummary,
  type JournalEntry,
  type NeedFlag,
  type RosterItem,
  type StarView,
} from '../api/client.js';

/** The button-cycle of screens (ARCHITECTURE.md §10). */
export const SCREENS = [
  'home',
  'status',
  'feed',
  'clean',
  'play',
  'comfort',
  'journal',
  'sky',
  'story',
  'lights',
] as const;
export type Screen = (typeof SCREENS)[number];

/** Turn care events into a short, satisfying "what changed" line. */
function summarizeCare(events: { kind: string; statDeltas?: Record<string, number> }[]): string {
  const e = events[0];
  if (!e) return 'nothing stirred';
  const parts = Object.entries(e.statDeltas ?? {})
    .filter(([, v]) => v !== 0)
    .map(([k, v]) => `${k} ${v > 0 ? '↑' : '↓'}`);
  return parts.length ? `${e.kind} · ${parts.join('  ')}` : e.kind;
}

/** The creature's reaction (emote) for a care event — drives the SVG animation. */
export type Emote = 'feed' | 'clean' | 'play' | 'comfort' | 'refused' | 'sleep' | 'woke' | 'peek';

const EMOTE_BY_KIND: Record<string, Emote> = {
  fed: 'feed',
  cleaned: 'clean',
  played: 'play',
  comforted: 'comfort',
  refused: 'refused',
  tooTired: 'refused',
  fellAsleep: 'sleep',
  woke: 'woke',
};

function emoteForEvents(events: { kind: string }[]): Emote | null {
  for (const e of events) {
    const em = EMOTE_BY_KIND[e.kind];
    if (em) return em;
  }
  return null;
}

const CARE_BY_SCREEN: Partial<Record<Screen, CareAction>> = {
  feed: 'feed',
  clean: 'clean',
  play: 'play',
  comfort: 'comfort',
};

/** Debounce peeks: a model call at most once per few minutes; show the cached line between. */
export const PEEK_DEBOUNCE_MS = 2 * 60 * 1000;

const CREATURE_KEY = 'amabo:creatureId';

function saveCreatureId(id: string | null): void {
  try {
    if (typeof localStorage === 'undefined') return;
    if (id) localStorage.setItem(CREATURE_KEY, id);
    else localStorage.removeItem(CREATURE_KEY);
  } catch {
    /* ignore (private mode etc.) */
  }
}

/** Which top-level view is showing: the roster of amabos, or one open creature. */
export type Route = 'dashboard' | 'device';

export interface GameState {
  client: ApiClient;
  /** Session state: null while the first check is in flight, then true/false. */
  authed: boolean | null;
  /** The signed-in Light's whole roster (the dashboard), each with its urgency signals. */
  creatures: RosterItem[];
  /** The currently-open creature (null on the dashboard). */
  creature: CreatureViewT | null;
  /** The open creature's urgency signals (so the device can offer e.g. "share its light"). */
  creatureNeeds: NeedFlag[];
  route: Route;
  journalEntries: JournalEntry[];
  stars: StarView[];
  screen: Screen;
  lastJournal: string | null;
  mood: string | null;
  /** The "while you were away" recap shown when a creature is opened; null = dismissed. */
  reveal: GapSummary | null;
  /** Set the moment a creature ascends — drives the full-screen graduation ceremony. */
  graduation: StarView | null;
  /** Short "what just changed" feedback after a care action. */
  lastResult: string | null;
  /** The creature's current reaction; `emoteNonce` bumps so the same emote re-fires. */
  emote: Emote | null;
  emoteNonce: number;
  busy: boolean;
  error: string | null;
  lastPeekAt: number;
  muted: boolean;
  highContrast: boolean;

  setClient(client: ApiClient): void;
  toggleMute(): void;
  toggleContrast(): void;
  /** On boot: check for an existing session and load the roster if signed in. */
  checkSession(): Promise<void>;
  /** Passwordless sign-in; on success loads the roster and flips `authed` true. */
  signInWithEmail(email: string): Promise<void>;
  /** Load the roster from the server (call after auth, and when returning to it). */
  loadDashboard(): Promise<void>;
  /** Open one creature into the device view (peeks, so the away-recap can show). */
  openCreature(id: string): Promise<void>;
  /** Dismiss the "while you were away" recap. */
  dismissReveal(): void;
  /** Dismiss the graduation ceremony and return to the roster. */
  dismissGraduation(): Promise<void>;
  /** The Symposium split — let an overflowing creature share its light into a sibling. */
  multiply(): Promise<void>;
  /** Introduce two of your creatures; returns a human line about how they resonated. */
  meet(aId: string, bId: string): Promise<string>;
  /** Return to the roster. */
  openDashboard(): Promise<void>;
  /** End the session and clear all local state. */
  signOut(): Promise<void>;
  start(name?: string): Promise<void>;
  refresh(): Promise<void>;
  peek(): Promise<void>;
  /** Button B — act on the current screen. */
  confirm(): Promise<void>;
  /** Button A — next screen. */
  next(): void;
  /** Button C — back to home. */
  back(): void;
}

export const useGame = create<GameState>((set, get) => ({
  client: new HttpApiClient(),
  authed: null,
  creatures: [],
  creature: null,
  creatureNeeds: [],
  route: 'dashboard',
  journalEntries: [],
  stars: [],
  screen: 'home',
  lastJournal: null,
  mood: null,
  reveal: null,
  graduation: null,
  lastResult: null,
  emote: null,
  emoteNonce: 0,
  busy: false,
  error: null,
  lastPeekAt: 0,
  muted: false,
  highContrast: false,

  setClient: (client) => set({ client }),
  toggleMute: () => set((s) => ({ muted: !s.muted })),
  toggleContrast: () => set((s) => ({ highContrast: !s.highContrast })),

  checkSession: async () => {
    const me = await get().client.me();
    if (me) {
      await get().loadDashboard();
      set({ authed: true });
    } else {
      set({ authed: false });
    }
  },

  signInWithEmail: async (email) => {
    await get().client.loginWithEmail(email.trim());
    await get().loadDashboard();
    set({ authed: true, route: 'dashboard' });
  },

  loadDashboard: async () => {
    try {
      set({ creatures: await get().client.listCreatures() });
    } catch (e) {
      set({ error: friendlyError(e) });
    }
  },

  openCreature: async (id) => {
    set({ busy: true, error: null });
    try {
      // Peek on open: catch up, narrate, and capture the "while you were away" recap.
      const r = await get().client.peek(id);
      saveCreatureId(id);
      set((st) => ({
        creature: r.creature,
        creatureNeeds: r.needs ?? [],
        route: 'device',
        screen: 'home',
        lastResult: null,
        lastJournal: r.journal,
        mood: r.mood,
        reveal: r.away ?? null,
        graduation: r.graduated ?? null,
        emote: 'peek',
        emoteNonce: st.emoteNonce + 1,
        lastPeekAt: Date.now(),
      }));
    } catch {
      // Narration unavailable — still open the device with the caught-up creature.
      try {
        const creature = await get().client.getCreature(id);
        saveCreatureId(id);
        set({ creature, route: 'device', screen: 'home', lastResult: null, reveal: null });
      } catch (e) {
        set({ error: friendlyError(e) });
      }
    } finally {
      set({ busy: false });
    }
  },

  dismissReveal: () => set({ reveal: null }),

  meet: async (aId, bId) => {
    set({ busy: true, error: null });
    try {
      const r = await get().client.meet(aId, bId);
      await get().loadDashboard(); // both came away a little changed
      const [a, b] = r.names;
      return r.result === 'harmony'
        ? `${a} and ${b} harmonized ✦`
        : `${a} and ${b} met, a little wary`;
    } catch (e) {
      set({ error: friendlyError(e) });
      return 'they could not meet just now';
    } finally {
      set({ busy: false });
    }
  },

  dismissGraduation: async () => {
    set({ graduation: null });
    await get().openDashboard(); // the creature has ascended; back to the roster
  },

  multiply: async () => {
    const { creature, client } = get();
    if (!creature) return;
    set({ busy: true, error: null });
    try {
      const { child } = await client.multiply(creature.id);
      set((s) => ({ creatures: [...s.creatures, child], lastResult: 'it shared its light ✧' }));
      await get().openDashboard(); // show the new found-family member
    } catch (e) {
      set({ error: friendlyError(e) });
    } finally {
      set({ busy: false });
    }
  },

  openDashboard: async () => {
    set({ route: 'dashboard', creature: null, screen: 'home', reveal: null, graduation: null });
    saveCreatureId(null);
    await get().loadDashboard();
  },

  signOut: async () => {
    try {
      await get().client.logout();
    } finally {
      saveCreatureId(null);
      // Flip `authed` false so the app routes back to the sign-in screen (not an empty
      // dashboard) — auth state lives here, not in a component's local state.
      set({ authed: false, creatures: [], creature: null, route: 'dashboard', screen: 'home' });
    }
  },

  start: async (name = 'Mote') => {
    set({ busy: true, error: null });
    try {
      const creature = await get().client.createCreature(name.trim() || 'Mote');
      saveCreatureId(creature.id);
      set((s) => ({
        creature,
        creatures: [...s.creatures, { ...creature, needs: [] }],
        route: 'device',
        screen: 'home',
      }));
    } catch (e) {
      set({ error: friendlyError(e) });
    } finally {
      set({ busy: false });
    }
  },

  refresh: async () => {
    const { creature, client } = get();
    if (!creature) return;
    const c = await client.getCreature(creature.id);
    set({ creature: c, creatureNeeds: c.needs });
  },

  peek: async () => {
    const { creature, client, lastPeekAt, lastJournal } = get();
    if (!creature) return;
    // Debounce: between peeks, keep showing the cached "while you were away" line.
    if (lastJournal && Date.now() - lastPeekAt < PEEK_DEBOUNCE_MS) return;
    set({ busy: true });
    try {
      const r = await client.peek(creature.id);
      set((st) => ({
        creature: r.creature,
        creatureNeeds: r.needs ?? st.creatureNeeds,
        lastJournal: r.journal,
        mood: r.mood,
        graduation: r.graduated ?? st.graduation,
        lastPeekAt: Date.now(),
        emote: 'peek',
        emoteNonce: st.emoteNonce + 1,
      }));
    } finally {
      set({ busy: false });
    }
  },

  confirm: async () => {
    const { screen, creature, client } = get();
    if (!creature) {
      await get().start();
      return;
    }
    const action = CARE_BY_SCREEN[screen];
    if (action) {
      set({ busy: true, error: null });
      try {
        const {
          creature: updated,
          events,
          needs: nextNeeds,
        } = await client.interact(creature.id, action);
        const emote = emoteForEvents(events);
        set((st) => ({
          creature: updated,
          creatureNeeds: nextNeeds ?? st.creatureNeeds,
          lastResult: summarizeCare(events),
          emote: emote ?? st.emote,
          emoteNonce: st.emoteNonce + 1,
        }));
      } catch (e) {
        set({ error: friendlyError(e) });
      } finally {
        set({ busy: false });
      }
      return;
    }
    if (screen === 'home') {
      await get().peek();
    } else if (screen === 'journal') {
      set({ journalEntries: await client.journal(creature.id) });
      await get().peek();
    } else if (screen === 'sky') {
      set({ stars: await client.stars(creature.id) });
    } else if (screen === 'lights') {
      set({ busy: true, error: null });
      try {
        const { creature: updated } = await client.interact(
          creature.id,
          creature.state.asleep ? 'wake' : 'sleep',
        );
        set((st) => ({
          creature: updated,
          lastResult: updated.state.asleep ? 'settled to sleep' : 'woke up',
          emote: updated.state.asleep ? 'sleep' : 'woke',
          emoteNonce: st.emoteNonce + 1,
        }));
      } catch (e) {
        set({ error: friendlyError(e) });
      } finally {
        set({ busy: false });
      }
    }
  },

  next: () => {
    const i = SCREENS.indexOf(get().screen);
    set({ screen: SCREENS[(i + 1) % SCREENS.length]!, lastResult: null, error: null });
  },

  back: () => set({ screen: 'home', lastResult: null, error: null }),
}));

/** A human-readable error for the device readout (auth/network hints, not raw codes). */
function friendlyError(e: unknown): string {
  const msg = (e as Error)?.message ?? 'something went wrong';
  if (msg.includes('401')) return 'signed out — reload to sign in again';
  if (msg.includes('403')) return 'session expired — reload the page';
  if (msg.includes('409')) return 'this one has graduated ✦';
  return 'could not reach the Amarium — try again';
}

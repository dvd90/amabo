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
  type JournalEntry,
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

function loadCreatureId(): string | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage.getItem(CREATURE_KEY) : null;
  } catch {
    return null;
  }
}
function saveCreatureId(id: string | null): void {
  try {
    if (typeof localStorage === 'undefined') return;
    if (id) localStorage.setItem(CREATURE_KEY, id);
    else localStorage.removeItem(CREATURE_KEY);
  } catch {
    /* ignore (private mode etc.) */
  }
}

export interface GameState {
  client: ApiClient;
  creature: CreatureViewT | null;
  journalEntries: JournalEntry[];
  stars: StarView[];
  screen: Screen;
  lastJournal: string | null;
  mood: string | null;
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
  /** Reload the player's creature from the persisted id (call after auth on boot). */
  boot(): Promise<void>;
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
  creature: null,
  journalEntries: [],
  stars: [],
  screen: 'home',
  lastJournal: null,
  mood: null,
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

  boot: async () => {
    const id = loadCreatureId();
    if (!id) return;
    try {
      const creature = await get().client.getCreature(id);
      set({ creature });
    } catch {
      // The stored creature is gone (e.g. rehomed/graduated) — start fresh.
      saveCreatureId(null);
    }
  },

  start: async (name = 'Mote') => {
    set({ busy: true, error: null });
    try {
      const creature = await get().client.createCreature(name.trim() || 'Mote');
      saveCreatureId(creature.id);
      set({ creature });
    } catch (e) {
      set({ error: (e as Error).message });
    } finally {
      set({ busy: false });
    }
  },

  refresh: async () => {
    const { creature, client } = get();
    if (!creature) return;
    set({ creature: await client.getCreature(creature.id) });
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
        lastJournal: r.journal,
        mood: r.mood,
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
        const { creature: updated, events } = await client.interact(creature.id, action);
        const emote = emoteForEvents(events);
        set((st) => ({
          creature: updated,
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

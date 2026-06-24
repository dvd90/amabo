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
  'lights',
] as const;
export type Screen = (typeof SCREENS)[number];

const CARE_BY_SCREEN: Partial<Record<Screen, CareAction>> = {
  feed: 'feed',
  clean: 'clean',
  play: 'play',
  comfort: 'comfort',
};

/** Debounce peeks: a model call at most once per few minutes; show the cached line between. */
export const PEEK_DEBOUNCE_MS = 2 * 60 * 1000;

export interface GameState {
  client: ApiClient;
  creature: CreatureViewT | null;
  journalEntries: JournalEntry[];
  stars: StarView[];
  screen: Screen;
  lastJournal: string | null;
  mood: string | null;
  busy: boolean;
  error: string | null;
  lastPeekAt: number;
  muted: boolean;
  highContrast: boolean;

  setClient(client: ApiClient): void;
  toggleMute(): void;
  toggleContrast(): void;
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
  busy: false,
  error: null,
  lastPeekAt: 0,
  muted: false,
  highContrast: false,

  setClient: (client) => set({ client }),
  toggleMute: () => set((s) => ({ muted: !s.muted })),
  toggleContrast: () => set((s) => ({ highContrast: !s.highContrast })),

  start: async (name = 'Mote') => {
    set({ busy: true, error: null });
    try {
      const creature = await get().client.createCreature(name);
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
      set({ creature: r.creature, lastJournal: r.journal, mood: r.mood, lastPeekAt: Date.now() });
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
      set({ busy: true });
      try {
        const { creature: updated } = await client.interact(creature.id, action);
        set({ creature: updated });
      } catch (e) {
        set({ error: (e as Error).message });
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
      const { creature: updated } = await client.interact(
        creature.id,
        creature.state.asleep ? 'wake' : 'sleep',
      );
      set({ creature: updated });
    }
  },

  next: () => {
    const i = SCREENS.indexOf(get().screen);
    set({ screen: SCREENS[(i + 1) % SCREENS.length]! });
  },

  back: () => set({ screen: 'home' }),
}));

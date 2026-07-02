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
  type GatheringView,
  type IncomingRehome,
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

// The pre-signup birth moment (the funnel's front door). "Seen" distinguishes a brand-new
// visitor from a returning-but-logged-out one; "demo seed" lets the Mote met at the door
// become the very creature kept after signup (the one you met is the one you keep).
const SEEN_BIRTH_KEY = 'amabo:seenBirth';
const DEMO_SEED_KEY = 'amabo:demoSeed';
/** Opt-in pixel-art skin (default off, fully reversible — purely a render swap). */
const PIXEL_KEY = 'amabo:pixel';
/** The chosen colour theme (retints the UI accent; see styles.css [data-theme]). */
const THEME_KEY = 'amabo:theme';

/** The colour themes offered in Settings. `swatch` is just the dot shown in the picker. */
export const THEMES = [
  { id: 'ember', label: 'Ember', swatch: 'hsl(38 90% 55%)' },
  { id: 'solar', label: 'Solar', swatch: 'hsl(14 95% 58%)' },
  { id: 'candy', label: 'Candy', swatch: 'hsl(330 95% 64%)' },
  { id: 'grape', label: 'Grape', swatch: 'hsl(270 92% 67%)' },
  { id: 'aqua', label: 'Aqua', swatch: 'hsl(187 92% 52%)' },
  { id: 'neon', label: 'Neon', swatch: 'hsl(150 88% 48%)' },
] as const;
export type ThemeId = (typeof THEMES)[number]['id'];

function readTheme(): ThemeId {
  const t = readLocal(THEME_KEY);
  return (THEMES.find((x) => x.id === t)?.id ?? 'ember') as ThemeId;
}

/** A theme id from the server is only trusted if it's still one we know how to render. */
function coerceTheme(id: string | undefined): ThemeId | null {
  return (THEMES.find((x) => x.id === id)?.id as ThemeId | undefined) ?? null;
}

function readLocal(key: string): string | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage.getItem(key);
  } catch {
    return null;
  }
}
function writeLocal(key: string, value: string | null): void {
  try {
    if (typeof localStorage === 'undefined') return;
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* ignore (private mode etc.) */
  }
}

/** Which top-level view is showing: the roster of amabos, or one open creature. */
export type Route = 'dashboard' | 'device' | 'glade';

/** Which logged-out view: the birth-moment welcome (the hook) or the sign-in form. */
export type AuthView = 'welcome' | 'login';

export interface GameState {
  client: ApiClient;
  /** Session state: null while the first check is in flight, then true/false. */
  authed: boolean | null;
  /** The Light's stated age band; null = not yet confirmed (the AgeGate shows). */
  ageBand: string | null;
  /** While logged out: the birth-moment welcome (the hook) or the sign-in form. */
  authView: AuthView;
  /** True if this device has met the birth moment before (logged-out return visit). */
  returningVisitor: boolean;
  /** The address a magic link was just sent to (drives the "check your inbox" panel). */
  magicSent: string | null;
  /** Only set in local dev (no real mailer): the magic link, surfaced for one-click testing. */
  magicDevLink: string | null;
  /** The signed-in Light's whole roster (the dashboard), each with its urgency signals. */
  creatures: RosterItem[];
  /** Pending rehomes addressed to me — the accept inbox on the dashboard. */
  incoming: IncomingRehome[];
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
  /** The held Symposium gathering shown in the Glade (null = none yet). */
  gathering: GatheringView | null;
  /** A just-resonated meeting, played as a small duet scene (null = none showing).
   *  `warmedName` names the souring one a harmony drew back toward the light. */
  duet: {
    result: 'harmony' | 'clash';
    a: string;
    b: string;
    names: [string, string];
    warmedName: string | null;
  } | null;
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
  /** Opt-in pixel-art creature skin (default off; persisted; fully reversible). */
  pixelMode: boolean;
  /** The chosen colour theme (retints the UI accent; persisted). */
  theme: ThemeId;

  setClient(client: ApiClient): void;
  toggleMute(): void;
  toggleContrast(): void;
  /** Flip the pixel-art skin on/off (persists to localStorage). */
  togglePixel(): void;
  /** Choose a colour theme (persists to localStorage). */
  setTheme(theme: ThemeId): void;
  /** On boot: check for an existing session and load the roster if signed in. */
  checkSession(): Promise<void>;
  /** Leave the birth-moment welcome for the sign-in form ("keep this light"). */
  showLogin(): void;
  /** Remember the seed of the Mote met at the door, so signup keeps that very creature. */
  rememberDemoSeed(seed: number): void;
  /** Request a magic sign-in link; sets `magicSent` (the user must follow the email). */
  signInWithEmail(email: string): Promise<void>;
  /** Clear the "check your inbox" panel (e.g. to try a different address). */
  clearMagic(): void;
  /** Load the roster from the server (call after auth, and when returning to it). */
  loadDashboard(): Promise<void>;
  /** Open the Glade (the Symposium) to choose who gathers. */
  openGlade(): void;
  /** Leave the Glade back to the dashboard. */
  closeGlade(): void;
  /**
   * Hold a gathering of the chosen creatures (optionally on a theme), optionally bringing
   * friends' creatures in as guests via their 'gather' passes (STORY.md §6¾); shows the scene.
   */
  holdSymposium(ids: string[], topic?: string, guestTokens?: string[]): Promise<void>;
  /** Mint a guest pass (a scoped, revocable link) so a friend can bring this creature. */
  mintGuestPass(creatureId: string): Promise<string | null>;
  /** Open one creature into the device view (peeks, so the away-recap can show). */
  openCreature(id: string): Promise<void>;
  /** Dismiss the "while you were away" recap. */
  dismissReveal(): void;
  /** Dismiss the graduation ceremony and return to the roster. */
  dismissGraduation(): Promise<void>;
  /** The Symposium split — let an overflowing creature share its light into a sibling. */
  multiply(): Promise<void>;
  /** Introduce two of your creatures; returns a human line about how they resonated
   *  and stages the duet scene (`duet`) so the meeting is *seen*, not just read. */
  meet(aId: string, bId: string): Promise<string>;
  /** Close the duet scene. */
  dismissDuet(): void;
  /** Mint a shareable postcard link for the open creature; returns the URL (or null). */
  shareCreature(): Promise<string | null>;
  /** Entrust the open creature to another Light by email; returns a status line. */
  rehome(email: string): Promise<string>;
  /** Accept an incoming rehome, then refresh the roster (the creature is now mine). */
  acceptRehome(id: string): Promise<void>;
  /** Lay an ended light to rest (the ceremony's confirm), then refresh the roster. */
  layToRest(id: string): Promise<void>;
  /** Return to the roster. */
  openDashboard(): Promise<void>;
  /** End the session and clear all local state. */
  signOut(): Promise<void>;
  /** State the age band once (L2) — unblocks creature creation. */
  confirmAge(band: '13-17' | '18+'): Promise<void>;
  /** Delete the account and everything in it; confirm must be the account email. */
  deleteAccount(confirm: string): Promise<boolean>;
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
  ageBand: null,
  authView: 'welcome',
  returningVisitor: false,
  magicSent: null,
  magicDevLink: null,
  gathering: null,
  duet: null,
  creatures: [],
  incoming: [],
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
  pixelMode: readLocal(PIXEL_KEY) === '1',
  theme: readTheme(),

  setClient: (client) => set({ client }),
  toggleMute: () => set((s) => ({ muted: !s.muted })),
  toggleContrast: () => set((s) => ({ highContrast: !s.highContrast })),
  togglePixel: () => {
    const pixelMode = !get().pixelMode;
    writeLocal(PIXEL_KEY, pixelMode ? '1' : null);
    set({ pixelMode });
    // Beside the local cache (instant, works signed out), save it at the account level
    // so it follows the Light to any device. Best-effort — local already applied.
    if (get().authed)
      void get()
        .client.updatePreferences({ pixelMode })
        .catch(() => {});
  },
  setTheme: (theme) => {
    writeLocal(THEME_KEY, theme === 'ember' ? null : theme);
    set({ theme });
    if (get().authed)
      void get()
        .client.updatePreferences({ theme })
        .catch(() => {});
  },

  checkSession: async () => {
    const me = await get().client.me();
    if (me) {
      set({ ageBand: me.user.ageBand ?? null });
      await get().loadDashboard();
      // The account-level prefs are the source of truth once signed in; reconcile the
      // local cache to match (so the *next* signed-out boot on this device agrees too).
      const prefs = me.user.preferences;
      const theme = coerceTheme(prefs?.theme);
      if (theme) writeLocal(THEME_KEY, theme === 'ember' ? null : theme);
      if (typeof prefs?.pixelMode === 'boolean') {
        writeLocal(PIXEL_KEY, prefs.pixelMode ? '1' : null);
      }
      set({
        authed: true,
        ...(theme ? { theme } : {}),
        ...(typeof prefs?.pixelMode === 'boolean' ? { pixelMode: prefs.pixelMode } : {}),
      });
    } else {
      // Logged out → the birth moment. A device that has met it before sees a warmer welcome.
      set({
        authed: false,
        authView: 'welcome',
        returningVisitor: readLocal(SEEN_BIRTH_KEY) === '1',
      });
      writeLocal(SEEN_BIRTH_KEY, '1');
    }
  },

  showLogin: () => set({ authView: 'login' }),
  rememberDemoSeed: (seed) => writeLocal(DEMO_SEED_KEY, String(seed)),

  signInWithEmail: async (email) => {
    const addr = email.trim();
    const r = await get().client.loginWithEmail(addr);
    set({ magicSent: addr, magicDevLink: r.devLink ?? null });
  },
  clearMagic: () => set({ magicSent: null, magicDevLink: null }),

  openGlade: () => set({ route: 'glade', gathering: null }),
  closeGlade: () => set({ route: 'dashboard', gathering: null }),
  holdSymposium: async (ids, topic, guestTokens) => {
    set({ busy: true });
    try {
      const gathering = await get().client.gather(ids, topic, guestTokens);
      set({ gathering });
      await get().loadDashboard(); // the gathering changed everyone's stats
    } finally {
      set({ busy: false });
    }
  },

  mintGuestPass: async (creatureId) => {
    try {
      return (await get().client.share(creatureId, 'gather')).url;
    } catch (e) {
      set({ error: friendlyError(e) });
      return null;
    }
  },

  loadDashboard: async () => {
    try {
      const [creatures, incoming] = await Promise.all([
        get().client.listCreatures(),
        get()
          .client.incomingRehomes()
          .catch(() => []),
      ]);
      set({ creatures, incoming });
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
    // Capture the pair BEFORE the refresh, so the duet can say who was drawn back.
    const pre = get().creatures.filter((c) => c.id === aId || c.id === bId);
    try {
      const r = await get().client.meet(aId, bId);
      await get().loadDashboard(); // both came away a little changed
      const [a, b] = r.names;
      // A harmony pulls each toward the other; the story beat is the souring one rising.
      const dim =
        pre.length === 2
          ? pre.reduce((p, q) => (p.state.disposition <= q.state.disposition ? p : q))
          : null;
      const warmedName =
        r.result === 'harmony' && dim && dim.state.disposition < 0 ? dim.name : null;
      // Stage the duet so the meeting is *seen* — the note is the after-line.
      set({
        duet: {
          result: r.result,
          a: aId,
          b: bId,
          names: [a ?? 'one', b ?? 'the other'],
          warmedName,
        },
      });
      return r.result === 'harmony'
        ? `${a} and ${b} harmonized ✦`
        : `${a} and ${b} met, a little wary`;
    } catch (e) {
      // The settling pause is part of the rite, not a failure — say it kindly.
      if ((e as Error)?.message?.includes('429')) {
        return 'they’ve just met — let it settle ☾';
      }
      set({ error: friendlyError(e) });
      return 'they could not meet just now';
    } finally {
      set({ busy: false });
    }
  },

  dismissDuet: () => set({ duet: null }),

  dismissGraduation: async () => {
    set({ graduation: null });
    await get().openDashboard(); // the creature has ascended; back to the roster
  },

  shareCreature: async () => {
    const { creature, client } = get();
    if (!creature) return null;
    try {
      return (await client.share(creature.id, 'postcard')).url;
    } catch (e) {
      set({ error: friendlyError(e) });
      return null;
    }
  },

  rehome: async (email) => {
    const { creature, client } = get();
    if (!creature) return 'no creature open';
    const to = email.trim();
    try {
      await client.rehome(creature.id, to);
      return `entrusted to ${to} — they’ll be asked to accept`;
    } catch (e) {
      return (e as Error).message.includes('404')
        ? 'no Light with that email yet'
        : 'could not entrust just now';
    }
  },

  acceptRehome: async (id) => {
    try {
      await get().client.acceptRehome(id);
      await get().openDashboard(); // it's mine now — refresh the roster
    } catch (e) {
      set({ error: friendlyError(e) });
    }
  },

  layToRest: async (id) => {
    try {
      await get().client.archive(id);
      await get().loadDashboard(); // it has left the shelf
    } catch (e) {
      set({ error: friendlyError(e) });
    }
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

  confirmAge: async (band) => {
    try {
      await get().client.setAge(band);
      set({ ageBand: band });
    } catch (e) {
      set({ error: friendlyError(e) });
    }
  },

  deleteAccount: async (confirm) => {
    try {
      await get().client.deleteAccount(confirm);
    } catch (e) {
      set({ error: friendlyError(e) });
      return false;
    }
    saveCreatureId(null);
    set({
      authed: false,
      ageBand: null,
      creatures: [],
      creature: null,
      route: 'dashboard',
      screen: 'home',
    });
    return true;
  },

  start: async (name = 'Mote') => {
    set({ busy: true, error: null });
    try {
      // If the visitor met a Mote at the door before signing in, keep that very one.
      const stashed = readLocal(DEMO_SEED_KEY);
      const seed =
        stashed !== null && Number.isFinite(Number(stashed)) ? Number(stashed) : undefined;
      const creature = await get().client.createCreature(name.trim() || 'Mote', seed);
      writeLocal(DEMO_SEED_KEY, null);
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

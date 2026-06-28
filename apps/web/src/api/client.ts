/**
 * api/client.ts — the device's thin window onto the API. Sends the session cookie
 * (credentials: 'include') and echoes the CSRF cookie back as a header on mutations.
 * Defined behind an interface so the store can be tested with a fake.
 */

import type { CreatureViewT } from '@amabo/shared';

export type { CreatureViewT };

export interface JournalEntry {
  at: number;
  kind: string;
  tag: string | null;
  text: string | null;
  salience: number;
}

export interface StarView {
  id: string;
  name: string;
  /** Epoch ms — when this soul was born and when it ascended (Mnemosyne). */
  bornAt: number;
  graduatedAt: number;
  constellationPos: { x: number; y: number };
}

/** Factual highlights of what changed while the Light was away (engine.summarizeGap). */
export type GapHighlight =
  | 'graduated'
  | 'grew'
  | 'brightened'
  | 'soured'
  | 'recovered'
  | 'fellIll'
  | 'rested'
  | 'content'
  | 'hungry'
  | 'lonely';

export interface GapSummary {
  elapsedMinutes: number;
  fromStage: string;
  toStage: string;
  highlights: GapHighlight[];
  deltas: Partial<Record<string, number>>;
}

export interface PeekResult {
  journal: string;
  mood: string;
  creature: CreatureViewT;
  away?: GapSummary;
  needs?: NeedFlag[];
  /** Set the moment a creature ascends during catch-up — triggers the ceremony. */
  graduated?: StarView | null;
}

export type CareAction = 'feed' | 'clean' | 'play' | 'comfort' | 'sleep' | 'wake';

export interface MeResult {
  user: { id: string; email?: string; displayName: string };
  csrfToken: string;
}

/** A lightweight event for showing care feedback ("ambra ↑"). */
export interface EventLite {
  kind: string;
  tag?: string | null;
  statDeltas?: Record<string, number>;
  dispositionDelta?: number;
}

export interface InteractResult {
  creature: CreatureViewT;
  events: EventLite[];
  needs?: NeedFlag[];
}

export interface AuthConfig {
  email: boolean;
  google: boolean;
}

/** The dashboard's urgency signals for a creature (engine.needs). */
export type NeedFlag =
  | 'ready'
  | 'overflowing'
  | 'souring'
  | 'ill'
  | 'hungry'
  | 'lonely'
  | 'asleep'
  | 'fading';

/** A roster card: the creature view plus its "who needs the Light" signals. */
export interface RosterItem extends CreatureViewT {
  needs: NeedFlag[];
}

/** The result of the Symposium split — the parent and its new other half. */
export interface MultiplyResult {
  parent: RosterItem;
  child: RosterItem;
}

/** The result of a resonance meeting between two creatures. */
export interface MeetResult {
  result: 'harmony' | 'clash';
  names: [string, string] | string[];
}

/** One line of a gathering's conversation ('' speaker = a stage direction). */
export interface TranscriptLine {
  speaker: string;
  text: string;
}

/** The Symposium — a held gathering of your own creatures (STORY.md §6½). */
export interface GatheringView {
  id: string;
  at: number;
  participants: { id: string; name: string; stage: string; uncanny: boolean }[];
  connections: { a: string; b: string; kind: 'harmony' | 'clash' }[];
  moments: { tag: 'play' | 'shareAmbra' | 'mentor'; participants: [string, string] }[];
  outcomes: { id: string; warmed: boolean; comfortedById: string | null; bondedWith: string[] }[];
  transcript: TranscriptLine[];
}

/** A minted share link. */
export interface ShareLink {
  token: string;
  kind: string;
  url: string;
  expiresAt: number;
}

/** The public, read-only view of a shared creature (a postcard). */
export interface PostcardView {
  name: string;
  stage: string;
  uncanny: boolean;
  graduated: boolean;
}

/** A pending rehome addressed to me (the accept inbox). */
export interface IncomingRehome {
  id: string;
  creatureId: string;
  creatureName: string;
  fromEmail: string;
  at: number;
}

export interface ApiClient {
  me(): Promise<MeResult | null>;
  /** Which sign-in methods the server offers (Google only when configured). */
  authConfig(): Promise<AuthConfig>;
  /**
   * Request a magic sign-in link by email. Does NOT sign in — the user must follow the
   * emailed link. `devLink` is only present in local dev (no real mail provider).
   */
  loginWithEmail(email: string): Promise<{ sent: boolean; devLink?: string }>;
  logout(): Promise<void>;
  listCreatures(): Promise<RosterItem[]>;
  createCreature(name: string): Promise<CreatureViewT>;
  getCreature(id: string): Promise<RosterItem>;
  peek(id: string): Promise<PeekResult>;
  interact(id: string, action: CareAction): Promise<InteractResult>;
  /** The Symposium split — only when the creature is overflowing. */
  multiply(id: string): Promise<MultiplyResult>;
  /** A resonance meeting between two of your own creatures (a duet, never a duel). */
  meet(id: string, otherId: string): Promise<MeetResult>;
  /** Hold a Symposium — gather 2–6 of your own creatures to speak of love (STORY.md §6½). */
  gather(creatureIds: string[]): Promise<GatheringView>;
  /** Mint a scoped, expiring share link for a creature. */
  share(id: string, kind: 'visit' | 'postcard'): Promise<ShareLink>;
  /** Fetch a shared creature's public, read-only postcard (no session needed). */
  postcard(token: string): Promise<PostcardView>;
  /** Entrust a creature to another Light by email (they must accept). */
  rehome(id: string, toEmail: string): Promise<void>;
  /** Pending rehomes addressed to me. */
  incomingRehomes(): Promise<IncomingRehome[]>;
  /** Accept an incoming rehome — ownership transfers to me. */
  acceptRehome(id: string): Promise<void>;
  /** The server's VAPID public key for web-push (null if push isn't configured). */
  vapidKey(): Promise<string | null>;
  /** Register a device's push subscription for the signed-in Light. */
  subscribePush(subscription: unknown): Promise<void>;
  journal(id: string): Promise<JournalEntry[]>;
  stars(id: string): Promise<StarView[]>;
}

function readCookie(name: string): string {
  const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return m ? decodeURIComponent(m[1]!) : '';
}

/**
 * The API base URL. Empty for a single-origin deploy (API serves the web); set
 * `VITE_API_BASE` at build time to the API's URL for a two-service deploy.
 */
export const API_BASE: string = import.meta.env.VITE_API_BASE ?? '';

export class HttpApiClient implements ApiClient {
  /** CSRF token from /me. Cross-origin we cannot read the cookie, so we cache it here. */
  private csrf = '';

  constructor(private base = API_BASE) {}

  private async req<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
    const headers: Record<string, string> = {};
    if (body !== undefined) headers['content-type'] = 'application/json';
    // Prefer the token from /me; fall back to the readable cookie (single-origin).
    if (method !== 'GET') headers['x-csrf-token'] = this.csrf || readCookie('amabo_csrf');
    const res = await fetch(`${this.base}${path}`, {
      method,
      headers,
      credentials: 'include',
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`${method} ${path} → ${res.status}`);
    return (await res.json()) as T;
  }

  async me() {
    try {
      const r = await this.req<MeResult>('/me');
      this.csrf = r.csrfToken ?? '';
      return r;
    } catch {
      return null;
    }
  }
  authConfig() {
    return this.req<AuthConfig>('/auth/config');
  }
  loginWithEmail(email: string) {
    return this.req<{ sent: boolean; devLink?: string }>('/auth/email', 'POST', { email });
  }
  async logout() {
    try {
      await this.req<{ ok: true }>('/auth/logout', 'POST', {});
    } finally {
      this.csrf = '';
    }
  }
  async listCreatures() {
    return (await this.req<{ creatures: RosterItem[] }>('/creatures')).creatures;
  }
  createCreature(name: string) {
    return this.req<CreatureViewT>('/creatures', 'POST', { name });
  }
  getCreature(id: string) {
    return this.req<RosterItem>(`/creatures/${id}`);
  }
  peek(id: string) {
    return this.req<PeekResult>(`/creatures/${id}/peek`, 'POST', {});
  }
  interact(id: string, action: CareAction) {
    return this.req<InteractResult>(`/creatures/${id}/interact`, 'POST', { action });
  }
  multiply(id: string) {
    return this.req<MultiplyResult>(`/creatures/${id}/multiply`, 'POST', {});
  }
  meet(id: string, otherId: string) {
    return this.req<MeetResult>(`/creatures/${id}/meet/${otherId}`, 'POST', {});
  }
  gather(creatureIds: string[]) {
    return this.req<GatheringView>('/symposium/gather', 'POST', { creatureIds });
  }
  share(id: string, kind: 'visit' | 'postcard') {
    return this.req<ShareLink>(`/creatures/${id}/share`, 'POST', { kind });
  }
  postcard(token: string) {
    return this.req<PostcardView>(`/postcard/${token}`);
  }
  async rehome(id: string, toEmail: string) {
    await this.req(`/creatures/${id}/rehome`, 'POST', { toEmail });
  }
  async incomingRehomes() {
    return (await this.req<{ incoming: IncomingRehome[] }>('/rehomes/incoming')).incoming;
  }
  async acceptRehome(id: string) {
    await this.req(`/rehome/${id}/confirm`, 'POST', {});
  }
  async vapidKey() {
    try {
      return (await this.req<{ key: string | null }>('/push/vapid')).key;
    } catch {
      return null;
    }
  }
  async subscribePush(subscription: unknown) {
    await this.req('/push/subscribe', 'POST', { subscription });
  }
  async journal(id: string) {
    return (await this.req<{ entries: JournalEntry[] }>(`/creatures/${id}/journal`)).entries;
  }
  async stars(id: string) {
    return (await this.req<{ stars: StarView[] }>(`/creatures/${id}/stars`)).stars;
  }
}

/** The login entry point (full-page redirect to Google OAuth on the API origin). */
export const LOGIN_URL = `${API_BASE}/auth/google`;

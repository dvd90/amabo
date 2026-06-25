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
  constellationPos: { x: number; y: number };
}

export interface PeekResult {
  journal: string;
  mood: string;
  creature: CreatureViewT;
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
}

export interface AuthConfig {
  email: boolean;
  google: boolean;
}

export interface ApiClient {
  me(): Promise<MeResult | null>;
  /** Which sign-in methods the server offers (Google only when configured). */
  authConfig(): Promise<AuthConfig>;
  /** Passwordless sign-in; resolves to the session (and caches the CSRF token). */
  loginWithEmail(email: string): Promise<MeResult>;
  logout(): Promise<void>;
  listCreatures(): Promise<CreatureViewT[]>;
  createCreature(name: string): Promise<CreatureViewT>;
  getCreature(id: string): Promise<CreatureViewT>;
  peek(id: string): Promise<PeekResult>;
  interact(id: string, action: CareAction): Promise<InteractResult>;
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
  async loginWithEmail(email: string) {
    const r = await this.req<MeResult>('/auth/email', 'POST', { email });
    this.csrf = r.csrfToken ?? '';
    return r;
  }
  async logout() {
    try {
      await this.req<{ ok: true }>('/auth/logout', 'POST', {});
    } finally {
      this.csrf = '';
    }
  }
  async listCreatures() {
    return (await this.req<{ creatures: CreatureViewT[] }>('/creatures')).creatures;
  }
  createCreature(name: string) {
    return this.req<CreatureViewT>('/creatures', 'POST', { name });
  }
  getCreature(id: string) {
    return this.req<CreatureViewT>(`/creatures/${id}`);
  }
  peek(id: string) {
    return this.req<PeekResult>(`/creatures/${id}/peek`, 'POST', {});
  }
  interact(id: string, action: CareAction) {
    return this.req<InteractResult>(`/creatures/${id}/interact`, 'POST', { action });
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

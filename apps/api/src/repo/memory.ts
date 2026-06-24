/**
 * repo/memory.ts — an in-memory Repository for tests (and a zero-setup local run).
 * It mirrors the owner-scoping contract exactly so handler tests exercise the real
 * 404-not-403 behaviour without a database.
 */

import type { SimEvent } from '@amabo/engine';
import { randomUUID } from 'node:crypto';
import type {
  CreatureRecord,
  JournalEntry,
  NewCreature,
  OAuthUpsert,
  Repository,
  SessionRecord,
  StarRecord,
  UserRecord,
} from './types.js';

interface StoredEvent extends SimEvent {
  creatureId: string;
  source: string;
  text: string | null;
}

export class InMemoryRepository implements Repository {
  private creatures = new Map<string, CreatureRecord>();
  private events: StoredEvent[] = [];
  private stars: StarRecord[] = [];
  private interactions: { creatureId: string; action: string; at: number }[] = [];
  private users = new Map<string, UserRecord>();
  private sessions = new Map<string, SessionRecord>();

  async createCreature(input: NewCreature): Promise<CreatureRecord> {
    const rec: CreatureRecord = {
      id: randomUUID(),
      ownerId: input.ownerId,
      name: input.name,
      state: input.state,
      graduatedAt: null,
      createdAt: Date.now(),
    };
    this.creatures.set(rec.id, rec);
    return structuredClone(rec);
  }

  async getCreature(id: string, ownerId: string | null): Promise<CreatureRecord | null> {
    const rec = this.creatures.get(id);
    if (!rec) return null;
    // Cross-owner reads return null (→ 404), never leaking existence.
    if (rec.ownerId !== ownerId) return null;
    return structuredClone(rec);
  }

  async saveCreature(rec: CreatureRecord): Promise<void> {
    this.creatures.set(rec.id, structuredClone(rec));
  }

  async appendEvents(creatureId: string, events: SimEvent[], source: 'sim' | 'ai' | 'user') {
    for (const e of events) {
      this.events.push({ ...e, creatureId, source, text: null });
    }
  }

  async listJournal(creatureId: string, limit: number, offset: number): Promise<JournalEntry[]> {
    return this.events
      .filter((e) => e.creatureId === creatureId)
      .sort((a, b) => b.at - a.at)
      .slice(offset, offset + limit)
      .map((e) => ({
        at: e.at,
        kind: e.kind,
        tag: e.tag ?? null,
        text: e.text,
        salience: e.salience,
      }));
  }

  async recordInteraction(creatureId: string, action: string, at: number): Promise<void> {
    this.interactions.push({ creatureId, action, at });
  }

  async addStar(input: Omit<StarRecord, 'id'>): Promise<StarRecord> {
    const star: StarRecord = { ...input, id: randomUUID() };
    this.stars.push(star);
    return structuredClone(star);
  }

  async listStars(ownerId: string | null): Promise<StarRecord[]> {
    return this.stars.filter((s) => s.ownerId === ownerId).map((s) => structuredClone(s));
  }

  async upsertUser(input: OAuthUpsert): Promise<UserRecord> {
    for (const u of this.users.values()) {
      if (u.oauthProvider === input.provider && u.oauthSubject === input.subject) {
        return structuredClone(u);
      }
    }
    const user: UserRecord = {
      id: randomUUID(),
      email: input.email,
      displayName: input.displayName,
      oauthProvider: input.provider,
      oauthSubject: input.subject,
      ageBand: input.ageBand ?? null,
      createdAt: Date.now(),
    };
    this.users.set(user.id, user);
    return structuredClone(user);
  }

  async getUserById(id: string): Promise<UserRecord | null> {
    const u = this.users.get(id);
    return u ? structuredClone(u) : null;
  }

  async createSession(
    userId: string,
    csrfToken: string,
    expiresAt: number,
  ): Promise<SessionRecord> {
    const session: SessionRecord = {
      id: randomUUID() + randomUUID(),
      userId,
      csrfToken,
      expiresAt,
    };
    this.sessions.set(session.id, session);
    return structuredClone(session);
  }

  async getSession(id: string): Promise<{ session: SessionRecord; user: UserRecord } | null> {
    const session = this.sessions.get(id);
    if (!session) return null;
    const user = this.users.get(session.userId);
    if (!user) return null;
    return { session: structuredClone(session), user: structuredClone(user) };
  }

  async deleteSession(id: string): Promise<void> {
    this.sessions.delete(id);
  }
}

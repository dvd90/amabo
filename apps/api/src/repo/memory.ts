/**
 * repo/memory.ts — an in-memory Repository for tests (and a zero-setup local run).
 * It mirrors the owner-scoping contract exactly so handler tests exercise the real
 * 404-not-403 behaviour without a database.
 */

import type { SimEvent } from '@amabo/engine';
import { randomUUID } from 'node:crypto';
import type {
  BondRecord,
  CreatureRecord,
  GatheringRecord,
  JournalEntry,
  NewCreature,
  OAuthUpsert,
  PushSubscriptionRecord,
  RehomeRecord,
  Repository,
  SessionRecord,
  ShareLinkRecord,
  StarRecord,
  TranscriptLine,
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
  private memories: { creatureId: string; at: number; text: string; salience: number }[] = [];
  private shareLinks = new Map<string, ShareLinkRecord>();
  private rehomes = new Map<string, RehomeRecord>();
  private blocks: { userId: string; blockedUserId: string; at: number }[] = [];
  private reports: { reporterId: string; subject: string; reason: string | null; at: number }[] =
    [];
  private pushSubs = new Map<string, PushSubscriptionRecord>();
  private gatherings = new Map<string, GatheringRecord>();
  private bonds: BondRecord[] = [];

  async createCreature(input: NewCreature): Promise<CreatureRecord> {
    const rec: CreatureRecord = {
      id: randomUUID(),
      ownerId: input.ownerId,
      name: input.name,
      state: input.state,
      graduatedAt: null,
      lastSeenAt: null,
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

  async listCreaturesByOwner(ownerId: string | null): Promise<CreatureRecord[]> {
    return [...this.creatures.values()]
      .filter((c) => c.ownerId === ownerId)
      .sort((a, b) => a.createdAt - b.createdAt)
      .map((c) => structuredClone(c));
  }

  async saveCreature(rec: CreatureRecord): Promise<void> {
    this.creatures.set(rec.id, structuredClone(rec));
  }

  async markSeen(id: string, at: number): Promise<void> {
    const rec = this.creatures.get(id);
    if (rec) rec.lastSeenAt = at;
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

  async addMemories(
    creatureId: string,
    memories: { at: number; text: string; salience: number }[],
  ): Promise<void> {
    for (const m of memories) this.memories.push({ creatureId, ...m });
  }

  async topMemories(
    creatureId: string,
    limit: number,
  ): Promise<{ text: string; salience: number }[]> {
    return this.memories
      .filter((m) => m.creatureId === creatureId)
      .sort((a, b) => b.salience - a.salience)
      .slice(0, limit)
      .map((m) => ({ text: m.text, salience: m.salience }));
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

  async getUserByEmail(email: string): Promise<UserRecord | null> {
    const lower = email.toLowerCase();
    for (const u of this.users.values()) {
      if (u.email.toLowerCase() === lower) return structuredClone(u);
    }
    return null;
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

  async createShareLink(
    input: Omit<ShareLinkRecord, 'id' | 'revokedAt'>,
  ): Promise<ShareLinkRecord> {
    const link: ShareLinkRecord = { ...input, id: randomUUID(), revokedAt: null };
    this.shareLinks.set(link.token, link);
    return structuredClone(link);
  }

  async getShareLink(token: string): Promise<ShareLinkRecord | null> {
    const link = this.shareLinks.get(token);
    return link ? structuredClone(link) : null;
  }

  async revokeShareLink(token: string, ownerId: string | null, at: number): Promise<boolean> {
    const link = this.shareLinks.get(token);
    if (!link || link.ownerId !== ownerId) return false; // owner-scoped
    link.revokedAt = at;
    return true;
  }

  async initiateRehome(
    input: Omit<RehomeRecord, 'id' | 'status' | 'toConfirmedAt'>,
  ): Promise<RehomeRecord> {
    const rehome: RehomeRecord = {
      ...input,
      id: randomUUID(),
      status: 'pending',
      toConfirmedAt: null,
    };
    this.rehomes.set(rehome.id, rehome);
    return structuredClone(rehome);
  }

  async getRehome(id: string): Promise<RehomeRecord | null> {
    const r = this.rehomes.get(id);
    return r ? structuredClone(r) : null;
  }

  async listIncomingRehomes(userId: string) {
    return [...this.rehomes.values()]
      .filter((r) => r.status === 'pending' && r.toUserId === userId)
      .map((r) => ({
        id: r.id,
        creatureId: r.creatureId,
        creatureName: this.creatures.get(r.creatureId)?.name ?? 'a creature',
        fromEmail: this.users.get(r.fromUserId)?.email ?? 'someone',
        at: r.at,
      }));
  }

  async confirmRehome(id: string, userId: string, at: number): Promise<RehomeRecord | null> {
    const r = this.rehomes.get(id);
    if (!r || r.status !== 'pending') return null;
    if (userId === r.fromUserId) r.fromConfirmedAt = at;
    else if (userId === r.toUserId) r.toConfirmedAt = at;
    else return null; // a third party cannot confirm
    // Ownership moves ONLY after BOTH sides have confirmed.
    if (r.fromConfirmedAt && r.toConfirmedAt) {
      const creature = this.creatures.get(r.creatureId);
      if (creature) creature.ownerId = r.toUserId;
      r.status = 'completed';
    }
    return structuredClone(r);
  }

  async addBlock(userId: string, blockedUserId: string, at: number): Promise<void> {
    this.blocks.push({ userId, blockedUserId, at });
  }

  async addReport(
    reporterId: string,
    subject: string,
    reason: string | null,
    at: number,
  ): Promise<void> {
    this.reports.push({ reporterId, subject, reason, at });
  }

  async addPushSubscription(
    input: Omit<PushSubscriptionRecord, 'id' | 'createdAt' | 'lastNotifiedAt'>,
  ): Promise<PushSubscriptionRecord> {
    const existing = this.pushSubs.get(input.endpoint);
    const rec: PushSubscriptionRecord = existing
      ? { ...existing, ...input }
      : { ...input, id: randomUUID(), lastNotifiedAt: null, createdAt: Date.now() };
    this.pushSubs.set(rec.endpoint, rec);
    return structuredClone(rec);
  }

  async listPushSubscriptions(): Promise<PushSubscriptionRecord[]> {
    return [...this.pushSubs.values()].map((s) => structuredClone(s));
  }

  async deletePushSubscription(endpoint: string): Promise<void> {
    this.pushSubs.delete(endpoint);
  }

  async touchPushNotified(id: string, at: number): Promise<void> {
    for (const s of this.pushSubs.values()) if (s.id === id) s.lastNotifiedAt = at;
  }

  // ── The Symposium (M-S) ─────────────────────────────────────────────────────────
  async createGathering(input: Omit<GatheringRecord, 'id'>): Promise<GatheringRecord> {
    const rec: GatheringRecord = { ...structuredClone(input), id: randomUUID() };
    this.gatherings.set(rec.id, rec);
    return structuredClone(rec);
  }

  async getGathering(id: string, ownerId: string | null): Promise<GatheringRecord | null> {
    const rec = this.gatherings.get(id);
    if (!rec || rec.ownerId !== ownerId) return null;
    return structuredClone(rec);
  }

  async setGatheringTranscript(id: string, transcript: TranscriptLine[]): Promise<void> {
    const rec = this.gatherings.get(id);
    if (rec) rec.transcript = structuredClone(transcript);
  }

  async recordBonds(
    ownerId: string | null,
    pairs: { a: string; b: string; strength: number }[],
    at: number,
  ): Promise<void> {
    for (const { a, b, strength } of pairs) {
      const [ca, cb] = a < b ? [a, b] : [b, a];
      const existing = this.bonds.find(
        (x) => x.ownerId === ownerId && x.creatureA === ca && x.creatureB === cb,
      );
      if (existing) {
        existing.strength += strength;
        existing.metCount += 1;
        existing.lastMetAt = at;
      } else {
        this.bonds.push({
          id: randomUUID(),
          ownerId,
          creatureA: ca,
          creatureB: cb,
          strength,
          metCount: 1,
          lastMetAt: at,
        });
      }
    }
  }

  async listBonds(ownerId: string | null, creatureId: string): Promise<BondRecord[]> {
    return this.bonds
      .filter(
        (x) => x.ownerId === ownerId && (x.creatureA === creatureId || x.creatureB === creatureId),
      )
      .sort((p, q) => q.strength - p.strength)
      .map((x) => structuredClone(x));
  }
}

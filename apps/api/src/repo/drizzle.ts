/**
 * repo/drizzle.ts — the production Repository, backed by Postgres via Drizzle. Maps
 * rows ↔ domain records and enforces owner-scoping in SQL (cross-owner → null → 404).
 * The in-memory repo is the test double; this is what runs on Railway.
 */

import type { CreatureState, SimEvent } from '@amabo/engine';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { randomBytes } from 'node:crypto';
import type { Db } from '../db/client.js';
import {
  blocks,
  creatures,
  events as eventsTable,
  interactions,
  memories as memoriesTable,
  rehomes,
  reports,
  sessions,
  shareLinks,
  stars,
  users,
} from '../db/schema.js';
import type {
  CreatureRecord,
  JournalEntry,
  NewCreature,
  OAuthUpsert,
  RehomeRecord,
  Repository,
  SessionRecord,
  ShareKind,
  ShareLinkRecord,
  StarRecord,
  UserRecord,
} from './types.js';

type Row = typeof creatures.$inferSelect;

function rowToRecord(row: Row): CreatureRecord {
  const state: CreatureState = {
    seed: row.seed,
    stage: row.stage as CreatureState['stage'],
    disposition: row.disposition,
    ageMinutes: row.ageMinutes,
    stats: row.stats,
    asleep: row.asleep,
    ill: row.ill,
    uncanny: row.uncanny,
    alive: row.alive,
    mortality: row.mortality as CreatureState['mortality'],
    traits: row.traits,
    careHistory: row.careHistory,
    lastTickAt: row.lastTickAt,
  };
  return {
    id: row.id,
    ownerId: row.ownerId,
    name: row.name,
    state,
    graduatedAt: row.graduatedAt,
    lastSeenAt: row.lastSeenAt,
    createdAt: row.createdAt.getTime(),
  };
}

/** Owner filter that treats a null owner as "the single-user world" (IS NULL). */
function ownedBy(ownerId: string | null) {
  return ownerId === null ? isNull(creatures.ownerId) : eq(creatures.ownerId, ownerId);
}

function stateColumns(state: CreatureState) {
  return {
    seed: state.seed,
    stage: state.stage,
    disposition: state.disposition,
    ageMinutes: state.ageMinutes,
    stats: state.stats,
    asleep: state.asleep,
    ill: state.ill,
    uncanny: state.uncanny,
    alive: state.alive,
    mortality: state.mortality,
    traits: state.traits,
    careHistory: state.careHistory,
    lastTickAt: state.lastTickAt,
  };
}

export class DrizzleRepository implements Repository {
  constructor(private db: Db) {}

  async createCreature(input: NewCreature): Promise<CreatureRecord> {
    const [row] = await this.db
      .insert(creatures)
      .values({ ownerId: input.ownerId, name: input.name, ...stateColumns(input.state) })
      .returning();
    return rowToRecord(row!);
  }

  async getCreature(id: string, ownerId: string | null): Promise<CreatureRecord | null> {
    const [row] = await this.db
      .select()
      .from(creatures)
      .where(and(eq(creatures.id, id), ownedBy(ownerId)))
      .limit(1);
    return row ? rowToRecord(row) : null;
  }

  async listCreaturesByOwner(ownerId: string | null): Promise<CreatureRecord[]> {
    const rows = await this.db
      .select()
      .from(creatures)
      .where(ownedBy(ownerId))
      .orderBy(creatures.createdAt);
    return rows.map(rowToRecord);
  }

  async saveCreature(rec: CreatureRecord): Promise<void> {
    await this.db
      .update(creatures)
      .set({ ...stateColumns(rec.state), graduatedAt: rec.graduatedAt })
      .where(eq(creatures.id, rec.id));
  }

  async markSeen(id: string, at: number): Promise<void> {
    await this.db.update(creatures).set({ lastSeenAt: at }).where(eq(creatures.id, id));
  }

  async appendEvents(creatureId: string, list: SimEvent[], source: 'sim' | 'ai' | 'user') {
    if (list.length === 0) return;
    await this.db.insert(eventsTable).values(
      list.map((e) => ({
        creatureId,
        at: e.at,
        kind: e.kind,
        source,
        statDeltas: e.statDeltas,
        dispositionDelta: e.dispositionDelta,
        salience: e.salience,
        tag: e.tag ?? null,
      })),
    );
  }

  async listJournal(creatureId: string, limit: number, offset: number): Promise<JournalEntry[]> {
    const rows = await this.db
      .select()
      .from(eventsTable)
      .where(eq(eventsTable.creatureId, creatureId))
      .orderBy(desc(eventsTable.at))
      .limit(limit)
      .offset(offset);
    return rows.map((e) => ({
      at: e.at,
      kind: e.kind,
      tag: e.tag,
      text: e.text,
      salience: e.salience,
    }));
  }

  async recordInteraction(creatureId: string, action: string, at: number): Promise<void> {
    await this.db.insert(interactions).values({ creatureId, action, at });
  }

  async addStar(input: Omit<StarRecord, 'id'>): Promise<StarRecord> {
    const [row] = await this.db
      .insert(stars)
      .values({
        creatureId: input.creatureId,
        ownerId: input.ownerId,
        name: input.name,
        bornAt: input.bornAt,
        graduatedAt: input.graduatedAt,
        finalTraits: input.finalTraits,
        constellationPos: input.constellationPos,
      })
      .returning();
    return {
      id: row!.id,
      creatureId: row!.creatureId,
      ownerId: row!.ownerId,
      name: row!.name,
      bornAt: row!.bornAt,
      graduatedAt: row!.graduatedAt,
      finalTraits: row!.finalTraits,
      constellationPos: row!.constellationPos,
    };
  }

  async listStars(ownerId: string | null): Promise<StarRecord[]> {
    const rows = await this.db
      .select()
      .from(stars)
      .where(ownerId === null ? isNull(stars.ownerId) : eq(stars.ownerId, ownerId));
    return rows.map((row) => ({
      id: row.id,
      creatureId: row.creatureId,
      ownerId: row.ownerId,
      name: row.name,
      bornAt: row.bornAt,
      graduatedAt: row.graduatedAt,
      finalTraits: row.finalTraits,
      constellationPos: row.constellationPos,
    }));
  }

  async addMemories(
    creatureId: string,
    memories: { at: number; text: string; salience: number }[],
  ): Promise<void> {
    if (memories.length === 0) return;
    await this.db.insert(memoriesTable).values(memories.map((m) => ({ creatureId, ...m })));
  }

  async topMemories(
    creatureId: string,
    limit: number,
  ): Promise<{ text: string; salience: number }[]> {
    const rows = await this.db
      .select()
      .from(memoriesTable)
      .where(eq(memoriesTable.creatureId, creatureId))
      .orderBy(desc(memoriesTable.salience))
      .limit(limit);
    return rows.map((m) => ({ text: m.text, salience: m.salience }));
  }

  async upsertUser(input: OAuthUpsert): Promise<UserRecord> {
    const existing = await this.db
      .select()
      .from(users)
      .where(and(eq(users.oauthProvider, input.provider), eq(users.oauthSubject, input.subject)))
      .limit(1);
    if (existing[0]) return toUser(existing[0]);

    const [row] = await this.db
      .insert(users)
      .values({
        email: input.email,
        displayName: input.displayName,
        oauthProvider: input.provider,
        oauthSubject: input.subject,
        ageBand: input.ageBand ?? null,
      })
      .returning();
    return toUser(row!);
  }

  async getUserById(id: string): Promise<UserRecord | null> {
    const [row] = await this.db.select().from(users).where(eq(users.id, id)).limit(1);
    return row ? toUser(row) : null;
  }

  async createSession(
    userId: string,
    csrfToken: string,
    expiresAt: number,
  ): Promise<SessionRecord> {
    const id = randomBytes(32).toString('hex');
    const [row] = await this.db
      .insert(sessions)
      .values({ id, userId, csrfToken, expiresAt })
      .returning();
    return {
      id: row!.id,
      userId: row!.userId,
      csrfToken: row!.csrfToken,
      expiresAt: row!.expiresAt,
    };
  }

  async getSession(id: string): Promise<{ session: SessionRecord; user: UserRecord } | null> {
    const [row] = await this.db
      .select()
      .from(sessions)
      .innerJoin(users, eq(sessions.userId, users.id))
      .where(eq(sessions.id, id))
      .limit(1);
    if (!row) return null;
    return {
      session: {
        id: row.sessions.id,
        userId: row.sessions.userId,
        csrfToken: row.sessions.csrfToken,
        expiresAt: row.sessions.expiresAt,
      },
      user: toUser(row.users),
    };
  }

  async deleteSession(id: string): Promise<void> {
    await this.db.delete(sessions).where(eq(sessions.id, id));
  }

  async createShareLink(
    input: Omit<ShareLinkRecord, 'id' | 'revokedAt'>,
  ): Promise<ShareLinkRecord> {
    const [row] = await this.db.insert(shareLinks).values(input).returning();
    return toShareLink(row!);
  }

  async getShareLink(token: string): Promise<ShareLinkRecord | null> {
    const [row] = await this.db
      .select()
      .from(shareLinks)
      .where(eq(shareLinks.token, token))
      .limit(1);
    return row ? toShareLink(row) : null;
  }

  async revokeShareLink(token: string, ownerId: string | null, at: number): Promise<boolean> {
    const link = await this.getShareLink(token);
    if (!link || link.ownerId !== ownerId) return false;
    await this.db.update(shareLinks).set({ revokedAt: at }).where(eq(shareLinks.token, token));
    return true;
  }

  async initiateRehome(
    input: Omit<RehomeRecord, 'id' | 'status' | 'toConfirmedAt'>,
  ): Promise<RehomeRecord> {
    const [row] = await this.db
      .insert(rehomes)
      .values({ ...input, status: 'pending', toConfirmedAt: null })
      .returning();
    return toRehome(row!);
  }

  async getRehome(id: string): Promise<RehomeRecord | null> {
    const [row] = await this.db.select().from(rehomes).where(eq(rehomes.id, id)).limit(1);
    return row ? toRehome(row) : null;
  }

  async confirmRehome(id: string, userId: string, at: number): Promise<RehomeRecord | null> {
    const r = await this.getRehome(id);
    if (!r || r.status !== 'pending') return null;
    const patch: Partial<typeof rehomes.$inferInsert> = {};
    if (userId === r.fromUserId) patch.fromConfirmedAt = at;
    else if (userId === r.toUserId) patch.toConfirmedAt = at;
    else return null;

    const bothConfirmed =
      (r.fromConfirmedAt ?? patch.fromConfirmedAt) && (r.toConfirmedAt ?? patch.toConfirmedAt);
    if (bothConfirmed) {
      patch.status = 'completed';
      await this.db
        .update(creatures)
        .set({ ownerId: r.toUserId })
        .where(eq(creatures.id, r.creatureId));
    }
    await this.db.update(rehomes).set(patch).where(eq(rehomes.id, id));
    return (await this.getRehome(id))!;
  }

  async addBlock(userId: string, blockedUserId: string, at: number): Promise<void> {
    await this.db.insert(blocks).values({ userId, blockedUserId, at });
  }

  async addReport(
    reporterId: string,
    subject: string,
    reason: string | null,
    at: number,
  ): Promise<void> {
    await this.db.insert(reports).values({ reporterId, subject, reason, at });
  }
}

function toShareLink(row: typeof shareLinks.$inferSelect): ShareLinkRecord {
  return {
    id: row.id,
    creatureId: row.creatureId,
    ownerId: row.ownerId,
    kind: row.kind as ShareKind,
    token: row.token,
    expiresAt: row.expiresAt,
    revokedAt: row.revokedAt,
  };
}

function toRehome(row: typeof rehomes.$inferSelect): RehomeRecord {
  return {
    id: row.id,
    creatureId: row.creatureId,
    fromUserId: row.fromUserId,
    toUserId: row.toUserId,
    status: row.status as RehomeRecord['status'],
    fromConfirmedAt: row.fromConfirmedAt,
    toConfirmedAt: row.toConfirmedAt,
    at: row.at,
  };
}

function toUser(row: typeof users.$inferSelect): UserRecord {
  return {
    id: row.id,
    email: row.email,
    displayName: row.displayName,
    oauthProvider: row.oauthProvider,
    oauthSubject: row.oauthSubject,
    ageBand: row.ageBand,
    createdAt: row.createdAt.getTime(),
  };
}

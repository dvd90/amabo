/**
 * repo/drizzle.ts — the production Repository, backed by Postgres via Drizzle. Maps
 * rows ↔ domain records and enforces owner-scoping in SQL (cross-owner → null → 404).
 * The in-memory repo is the test double; this is what runs on Railway.
 */

import type { CreatureState, SimEvent } from '@amabo/engine';
import { and, desc, eq, isNull, sql, type AnyColumn } from 'drizzle-orm';
import { randomBytes } from 'node:crypto';
import type { Db } from '../db/client.js';
import {
  blocks,
  bonds,
  creatures,
  events as eventsTable,
  gatherings,
  interactions,
  letters,
  memories as memoriesTable,
  pushSubscriptions,
  rehomes,
  reports,
  sessions,
  shareLinks,
  stars,
  users,
} from '../db/schema.js';
import type {
  BondRecord,
  CreatureRecord,
  GatheringRecord,
  JournalEntry,
  LetterRecord,
  NewCreature,
  OAuthUpsert,
  PushSubscriptionRecord,
  RehomeRecord,
  Repository,
  SessionRecord,
  ShareKind,
  ShareLinkRecord,
  StarRecord,
  TranscriptLine,
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

/** The same null-aware owner scope, for any table's owner column. */
function ownerScope(col: AnyColumn, ownerId: string | null) {
  return ownerId === null ? isNull(col) : eq(col, ownerId);
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

  async getUserByEmail(email: string): Promise<UserRecord | null> {
    const [row] = await this.db
      .select()
      .from(users)
      .where(sql`lower(${users.email}) = ${email.toLowerCase()}`)
      .limit(1);
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

  async listIncomingRehomes(userId: string) {
    return this.db
      .select({
        id: rehomes.id,
        creatureId: rehomes.creatureId,
        creatureName: creatures.name,
        fromEmail: users.email,
        at: rehomes.at,
      })
      .from(rehomes)
      .innerJoin(creatures, eq(rehomes.creatureId, creatures.id))
      .innerJoin(users, eq(rehomes.fromUserId, users.id))
      .where(and(eq(rehomes.toUserId, userId), eq(rehomes.status, 'pending')));
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

  async addPushSubscription(
    input: Omit<PushSubscriptionRecord, 'id' | 'createdAt' | 'lastNotifiedAt'>,
  ): Promise<PushSubscriptionRecord> {
    const [row] = await this.db
      .insert(pushSubscriptions)
      .values(input)
      .onConflictDoUpdate({
        target: pushSubscriptions.endpoint,
        set: { userId: input.userId, p256dh: input.p256dh, auth: input.auth },
      })
      .returning();
    return toPushSub(row!);
  }

  async listPushSubscriptions(): Promise<PushSubscriptionRecord[]> {
    const rows = await this.db.select().from(pushSubscriptions);
    return rows.map(toPushSub);
  }

  async deletePushSubscription(endpoint: string): Promise<void> {
    await this.db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint));
  }

  async touchPushNotified(id: string, at: number): Promise<void> {
    await this.db
      .update(pushSubscriptions)
      .set({ lastNotifiedAt: at })
      .where(eq(pushSubscriptions.id, id));
  }

  // ── The Symposium (M-S) ─────────────────────────────────────────────────────────
  async createGathering(input: Omit<GatheringRecord, 'id'>): Promise<GatheringRecord> {
    const [row] = await this.db
      .insert(gatherings)
      .values({
        ownerId: input.ownerId,
        at: input.at,
        participantIds: input.participantIds,
        outline: input.outline,
        transcript: input.transcript,
      })
      .returning();
    return toGathering(row!);
  }

  async getGathering(id: string, ownerId: string | null): Promise<GatheringRecord | null> {
    const [row] = await this.db
      .select()
      .from(gatherings)
      .where(and(eq(gatherings.id, id), ownerScope(gatherings.ownerId, ownerId)))
      .limit(1);
    return row ? toGathering(row) : null;
  }

  async setGatheringTranscript(id: string, transcript: TranscriptLine[]): Promise<void> {
    await this.db.update(gatherings).set({ transcript }).where(eq(gatherings.id, id));
  }

  async recordBonds(
    ownerId: string | null,
    pairs: { a: string; b: string; strength: number }[],
    at: number,
  ): Promise<void> {
    for (const { a, b, strength } of pairs) {
      const [ca, cb] = a < b ? [a, b] : [b, a];
      const [existing] = await this.db
        .select()
        .from(bonds)
        .where(
          and(
            ownerScope(bonds.ownerId, ownerId),
            eq(bonds.creatureA, ca!),
            eq(bonds.creatureB, cb!),
          ),
        )
        .limit(1);
      if (existing) {
        await this.db
          .update(bonds)
          .set({
            strength: existing.strength + strength,
            metCount: existing.metCount + 1,
            lastMetAt: at,
          })
          .where(eq(bonds.id, existing.id));
      } else {
        await this.db.insert(bonds).values({
          ownerId,
          creatureA: ca!,
          creatureB: cb!,
          strength,
          metCount: 1,
          lastMetAt: at,
        });
      }
    }
  }

  async listBonds(ownerId: string | null, creatureId: string): Promise<BondRecord[]> {
    const rows = await this.db
      .select()
      .from(bonds)
      .where(
        and(
          ownerScope(bonds.ownerId, ownerId),
          sql`(${bonds.creatureA} = ${creatureId} OR ${bonds.creatureB} = ${creatureId})`,
        ),
      )
      .orderBy(desc(bonds.strength));
    return rows.map(toBond);
  }

  async listAllBonds(ownerId: string | null, limit: number): Promise<BondRecord[]> {
    const rows = await this.db
      .select()
      .from(bonds)
      .where(ownerScope(bonds.ownerId, ownerId))
      .orderBy(desc(bonds.strength))
      .limit(limit);
    return rows.map(toBond);
  }

  async createLetter(input: Omit<LetterRecord, 'id'>): Promise<LetterRecord> {
    const [row] = await this.db
      .insert(letters)
      .values({
        ownerId: input.ownerId,
        fromCreature: input.fromCreature,
        toCreature: input.toCreature,
        at: input.at,
        text: input.text,
      })
      .returning();
    return toLetter(row!);
  }

  async listLetters(ownerId: string | null, limit: number): Promise<LetterRecord[]> {
    const rows = await this.db
      .select()
      .from(letters)
      .where(ownerScope(letters.ownerId, ownerId))
      .orderBy(desc(letters.at))
      .limit(limit);
    return rows.map(toLetter);
  }
}

function toLetter(row: typeof letters.$inferSelect): LetterRecord {
  return {
    id: row.id,
    ownerId: row.ownerId,
    fromCreature: row.fromCreature,
    toCreature: row.toCreature,
    at: row.at,
    text: row.text,
  };
}

function toGathering(row: typeof gatherings.$inferSelect): GatheringRecord {
  return {
    id: row.id,
    ownerId: row.ownerId,
    at: row.at,
    participantIds: row.participantIds,
    outline: row.outline as GatheringRecord['outline'],
    transcript: (row.transcript as TranscriptLine[] | null) ?? null,
  };
}

function toBond(row: typeof bonds.$inferSelect): BondRecord {
  return {
    id: row.id,
    ownerId: row.ownerId,
    creatureA: row.creatureA,
    creatureB: row.creatureB,
    strength: row.strength,
    metCount: row.metCount,
    lastMetAt: row.lastMetAt,
  };
}

function toPushSub(row: typeof pushSubscriptions.$inferSelect): PushSubscriptionRecord {
  return {
    id: row.id,
    userId: row.userId,
    endpoint: row.endpoint,
    p256dh: row.p256dh,
    auth: row.auth,
    lastNotifiedAt: row.lastNotifiedAt,
    createdAt: row.createdAt.getTime(),
  };
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

/**
 * repo/drizzle.ts — the production Repository, backed by Postgres via Drizzle. Maps
 * rows ↔ domain records and enforces owner-scoping in SQL (cross-owner → null → 404).
 * The in-memory repo is the test double; this is what runs on Railway.
 */

import type { CreatureState, SimEvent } from '@amabo/engine';
import { and, desc, eq, isNull } from 'drizzle-orm';
import type { Db } from '../db/client.js';
import { creatures, events as eventsTable, interactions, stars } from '../db/schema.js';
import type { CreatureRecord, JournalEntry, NewCreature, Repository, StarRecord } from './types.js';

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

  async saveCreature(rec: CreatureRecord): Promise<void> {
    await this.db
      .update(creatures)
      .set({ ...stateColumns(rec.state), graduatedAt: rec.graduatedAt })
      .where(eq(creatures.id, rec.id));
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
}

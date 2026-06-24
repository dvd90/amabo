/**
 * service/catchup.ts — the lazy "simulate-on-read" core (ARCHITECTURE.md §3, §8).
 * On any read we replay the gap deterministically, persist, and — if the creature
 * graduated in the dark — write its Star and mark it ascended. Pure engine in, I/O
 * out; the clock is passed in from the edge.
 */

import { advance, graduate, type SimEvent } from '@amabo/engine';
import type { CreatureRecord, Repository, StarRecord } from '../repo/types.js';

export interface CatchUpResult {
  record: CreatureRecord;
  events: SimEvent[];
  graduated: StarRecord | null;
}

export async function catchUp(
  repo: Repository,
  rec: CreatureRecord,
  now: number,
): Promise<CatchUpResult> {
  // A creature that has already ascended into Elysium no longer ticks.
  if (rec.graduatedAt !== null) {
    return { record: rec, events: [], graduated: null };
  }

  const { state, events } = advance(rec.state, now);
  let record: CreatureRecord = { ...rec, state };
  let graduated: StarRecord | null = null;

  const gradEvent = events.find((e) => e.kind === 'graduation');
  if (gradEvent) {
    const { star } = graduate(state, rec.name, gradEvent.at);
    graduated = await repo.addStar({ ...star, creatureId: rec.id, ownerId: rec.ownerId });
    record = { ...record, graduatedAt: gradEvent.at };
  }

  await repo.saveCreature(record);
  if (events.length > 0) {
    await repo.appendEvents(rec.id, events, 'sim');
  }
  return { record, events, graduated };
}

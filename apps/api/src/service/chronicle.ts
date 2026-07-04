/**
 * service/chronicle.ts — the shelf's book, as a service (STORY.md §8⅞). Two pieces
 * shared by the routes AND the notify cron, so the world keeps writing whether a
 * Light is looking or not:
 *
 *  - `extendChronicle` — roll the gap's encounters (pure engine), voice them, and
 *    persist pages + standings + bond threads. Gap-gated by CHRONICLE.minGapMs, so
 *    no caller can spend model calls more than ~4×/day per shelf.
 *  - `makeChronicler` — the AI-backed chronicler: shares the narration breaker,
 *    lands in the cost ledger (mode 'chronicle'), logs its fallbacks, and degrades
 *    to the local templated book on any failure.
 */

import {
  localChronicle,
  voiceChronicle,
  type ChronicleResult,
  type ChronicleSceneInput,
} from '@amabo/ai';
import { CHRONICLE, bondDeltaFor, deriveSeed, mulberry32, rollEncounters } from '@amabo/engine';
import type { LlmChoice } from '../llm.js';
import type { Logger } from '../logger.js';
import type { Repository } from '../repo/types.js';

/** A first read (or a long-dead shelf) chronicles at most ~2 days back. */
export const LOOKBACK_CAP_MS = 8 * CHRONICLE.minGapMs;

export type Chronicler = (
  input: ChronicleSceneInput & { ownerId: string | null },
) => Promise<ChronicleResult>;

/**
 * Extend the book if enough dark has passed: roll encounters, voice them, persist
 * pages + standings + bond threads. Idempotent per gap — the next roll starts at
 * the last written page.
 */
export async function extendChronicle(
  repo: Repository,
  chronicler: Chronicler,
  owner: string | null,
  now: number,
): Promise<void> {
  const all = await repo.listCreaturesByOwner(owner);
  const active = all.filter(
    (c) => c.state.alive && c.graduatedAt === null && c.archivedAt === null,
  );
  if (active.length < 2) return;

  const last = await repo.lastChronicleAt(owner);
  const since = last ?? now - LOOKBACK_CAP_MS;
  const elapsed = Math.min(Math.max(now - since, 0), LOOKBACK_CAP_MS);

  const seedSum = active.reduce((sum, c) => (sum + c.state.seed) >>> 0, 0);
  const rng = mulberry32(deriveSeed(seedSum, Math.floor(now / 1000)));
  const outlines = rollEncounters(
    active.map((c) => ({ id: c.id, state: c.state })),
    elapsed,
    rng,
  );
  if (outlines.length === 0) return;

  const encounters = await Promise.all(
    outlines.map(async (o) => {
      const a = active.find((c) => c.id === o.aId)!;
      const b = active.find((c) => c.id === o.bId)!;
      const prior = await repo.getStanding(owner, o.aId, o.bId);
      return {
        aName: a.name,
        bName: b.name,
        valence: o.valence,
        tag: o.tag,
        aSoulmark: a.persona?.essence ?? null,
        bSoulmark: b.persona?.essence ?? null,
        standing: prior?.line ?? null,
      };
    }),
  );

  const book = await chronicler({ encounters, ownerId: owner });

  await repo.addChronicleEntries(
    outlines.map((o, i) => ({
      ownerId: owner,
      at: now,
      aId: o.aId,
      bId: o.bId,
      valence: o.valence,
      tag: o.tag,
      text: book.entries[i]?.text ?? '',
    })),
  );
  for (let i = 0; i < outlines.length; i++) {
    const o = outlines[i]!;
    const line = book.entries[i]?.standing;
    if (line) await repo.upsertStanding(owner, o.aId, o.bId, o.valence, line, now);
  }
  await repo.recordBonds(
    owner,
    outlines.map((o) => ({ a: o.aId, b: o.bId, strength: bondDeltaFor(o.valence) })),
    now,
  );
}

/**
 * The production chronicler: LLM-voiced when a provider is awake, sharing the
 * narration breaker; model calls land in the cost ledger (mode 'chronicle').
 * Local templated book otherwise, and on any failure — never an error.
 */
export function makeChronicler(
  llm: LlmChoice | null,
  repo: Repository,
  logger: Logger,
  clock: () => number,
  dailyCap: number,
): Chronicler {
  const log = logger.child('chronicle');
  return async (input) => {
    if (!llm) return localChronicle(input);
    try {
      const since = clock() - 24 * 60 * 60 * 1000;
      if ((await repo.countTelemetry('narration', { since })) >= dailyCap) {
        return localChronicle(input);
      }
      const out = await voiceChronicle(input, llm.client);
      if (out.source === 'local') {
        log.warn('model chronicle fell back to the local book', {
          provider: llm.provider,
          reason: out.reason ?? null,
        });
      } else {
        await repo.addTelemetry([
          {
            name: 'narration',
            anonId: null,
            userId: input.ownerId,
            at: clock(),
            props: {
              mode: 'chronicle',
              provider: llm.provider,
              inputTokens: out.usage?.inputTokens ?? null,
              outputTokens: out.usage?.outputTokens ?? null,
            },
          },
        ]);
      }
      return out;
    } catch (err) {
      log.error('the chronicler failed — the local book stands in', { err });
      return localChronicle(input);
    }
  };
}

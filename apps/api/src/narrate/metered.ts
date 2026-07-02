/**
 * narrate/metered.ts — the soul, with a sensible bill (LAUNCH_PLAN.md L3). Wraps the
 * model-backed narrator with two dams and a ledger:
 *
 *  - a PER-LIGHT daily allowance (rolling 24h) — past it, the voice degrades
 *    gracefully to the local templated narrator; the creature never goes mute;
 *  - a GLOBAL daily breaker — a hard cap on model calls per day so a surprise bill
 *    is impossible; tripping it alarms the monitor exactly once per trip;
 *  - a cost ledger — every model call lands in `telemetry` (name = 'narration')
 *    with its token usage; docs/FUNNEL.sql turns it into cost-per-user-per-day.
 *
 * The wrapper never throws and never surfaces an error to the device: every refusal
 * is just the local voice. Tunables arrive as deps so tests own the dials; L5 swaps
 * `userAllowancePerDay` for an entitlement-aware allowance.
 */

import type { Clock } from '../clock.js';
import type { Monitor } from '../monitor.js';
import type { Repository } from '../repo/types.js';
import type { Narrator } from './port.js';

export interface MeterDeps {
  repo: Repository;
  clock: Clock;
  monitor: Monitor;
  /** Model-narrated peeks per Light per rolling day — entitlement-aware (L5). */
  allowanceFor: (userId: string) => Promise<number>;
  /** Model calls per rolling day across ALL Lights — the no-surprise-bill breaker. */
  globalCallsPerDay: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function meteredNarrator(model: Narrator, fallback: Narrator, deps: MeterDeps): Narrator {
  const { repo, clock, monitor } = deps;
  let breakerAlarmed = false;

  return {
    async narrate(ctx, events, mode) {
      try {
        const now = clock();
        const since = now - DAY_MS;

        const global = await repo.countTelemetry('narration', { since });
        if (global >= deps.globalCallsPerDay) {
          if (!breakerAlarmed) {
            breakerAlarmed = true;
            monitor.capture(
              new Error(`narration budget breaker tripped (${deps.globalCallsPerDay}/day)`),
            );
          }
          return fallback.narrate(ctx, events, mode);
        }
        breakerAlarmed = false;

        const userId = ctx.ownerId ?? null;
        if (userId) {
          const mine = await repo.countTelemetry('narration', { since, userId });
          if (mine >= (await deps.allowanceFor(userId))) return fallback.narrate(ctx, events, mode);
        }

        const out = await model.narrate(ctx, events, mode);
        await repo.addTelemetry([
          {
            name: 'narration',
            anonId: null,
            userId,
            at: now,
            props: {
              mode,
              inputTokens: out.usage?.inputTokens ?? null,
              outputTokens: out.usage?.outputTokens ?? null,
            },
          },
        ]);
        return out;
      } catch {
        // The meter must never be the reason a creature goes silent.
        return fallback.narrate(ctx, events, mode);
      }
    },
  };
}

/**
 * notify/decide.ts — PURE. Decides whether (and what) to push to a Light's device, from
 * the current state of their creatures. The engine owns the thresholds (`needs`); this
 * owns the policy: a per-device cooldown, a priority order, and the gentle copy. Kept
 * pure so the cron's "who to ping" logic is unit-tested without a network or a clock.
 */

import { needs, type CreatureState, type NeedFlag } from '@amabo/engine';

export interface PushMessage {
  title: string;
  body: string;
}

export interface NotifyCandidate {
  name: string;
  state: CreatureState;
  lastSeenAt: number | null;
}

/** At most ~once per this window per device, so a ping always feels worth opening. */
export const NOTIFY_COOLDOWN_MS = 6 * 60 * 60 * 1000;
/** "Missed you" only after a real absence. */
export const MISS_MS = 24 * 60 * 60 * 1000;

/** Most-urgent-first; only the actionable needs warrant interrupting someone's day. */
const ORDER: NeedFlag[] = ['ill', 'souring', 'hungry', 'ready', 'overflowing'];

const COPY: Record<string, (name: string) => PushMessage> = {
  ill: (n) => ({
    title: `${n} isn't feeling well`,
    body: 'A wash and some comfort would help it mend.',
  }),
  souring: (n) => ({
    title: `${n} is dimming`,
    body: 'The glass is going dark — comfort is the way back.',
  }),
  hungry: (n) => ({ title: `${n}'s Ambra is low`, body: "It's waiting by the warm spot." }),
  ready: (n) => ({
    title: `${n} is ready to ascend ✦`,
    body: 'Too bright for the glass — look in before it goes.',
  }),
  overflowing: (n) => ({ title: `${n} is overflowing ✧`, body: 'It wants to share its light.' }),
};

export function decideNotification(
  creatures: NotifyCandidate[],
  now: number,
  lastNotifiedAt: number | null,
  cooldownMs: number = NOTIFY_COOLDOWN_MS,
): PushMessage | null {
  if (lastNotifiedAt != null && now - lastNotifiedAt < cooldownMs) return null;

  for (const need of ORDER) {
    const hit = creatures.find((c) => needs(c.state).includes(need));
    if (hit) return COPY[need]!(hit.name);
  }

  // Nothing urgent — but if one has been alone in the dark a long while, a soft nudge.
  const missed = creatures.find(
    (c) =>
      c.state.alive &&
      c.lastSeenAt != null &&
      now - c.lastSeenAt > MISS_MS &&
      c.state.stats.security < 60,
  );
  if (missed) {
    return { title: `${missed.name} misses the Light`, body: 'The glass has been dark a while.' };
  }
  return null;
}

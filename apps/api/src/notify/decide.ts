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

// The title says who and what; the BODY is the creature's own voice (M-L: a ping
// that sounds like a person is a heartbeat; one that sounds like an app is a chore).
const COPY: Record<string, (name: string) => PushMessage> = {
  ill: (n) => ({
    title: `${n} isn't feeling well`,
    body: '“I don\u2019t feel like myself. A little washing, a little warmth?”',
  }),
  souring: (n) => ({
    title: `${n} is dimming`,
    body: '“The clock stopped at the same soft hour again.”',
  }),
  hungry: (n) => ({
    title: `${n}'s Ambra is low`,
    body: '“I saved you the warm spot. Bring something to share?”',
  }),
  ready: (n) => ({
    title: `${n} is ready to ascend ✦`,
    body: '“I\u2019m almost too bright for the glass. Come see me before I go.”',
  }),
  overflowing: (n) => ({
    title: `${n} is overflowing ✧`,
    body: '“I have more light than I can hold. Help me share it?”',
  }),
};

/** A fresh Chronicle page worth telling the Light about (M-M). */
export interface SocialCandidate {
  aName: string;
  bName: string;
  valence: 'warm' | 'strained';
  text: string;
}

export function decideNotification(
  creatures: NotifyCandidate[],
  now: number,
  lastNotifiedAt: number | null,
  cooldownMs: number = NOTIFY_COOLDOWN_MS,
  social?: SocialCandidate | null,
): PushMessage | null {
  if (lastNotifiedAt != null && now - lastNotifiedAt < cooldownMs) return null;

  for (const need of ORDER) {
    const hit = creatures.find((c) => needs(c.state).includes(need));
    if (hit) return COPY[need]!(hit.name);
  }

  // Nothing urgent — but the shelf wrote a page: the strongest proof of a living
  // world is news about something two creatures did to each other, unprompted.
  if (social) {
    return {
      title: `${social.aName} & ${social.bName} met while you were away`,
      body: social.text.slice(0, 160),
    };
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
    return {
      title: `${missed.name} misses the Light`,
      body: '\u201cI kept a light for you. The glass has been dark a while.\u201d',
    };
  }
  return null;
}

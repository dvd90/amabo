/**
 * gather.ts — the Symposium rule (STORY.md §6½). PURE and seeded. A Light's creatures
 * gather in a shared glade; the meeting rule of `resonate` is run across the whole
 * company, and the results are averaged so a crowd never balloons the rewards. This owns
 * WHAT happens (deltas, who connected, who was warmed, what bonds formed, what moments
 * passed); the AI layer turns the returned outline into the conversation about love.
 *
 * A duet writ larger, never a duel: nobody is ever harmed. Warm company is a second way
 * back for a Yim — peers can comfort it toward the light, not only the Light.
 */

import { STAGES } from '@amabo/shared';
import { GATHER } from './config.js';
import { resonate, type ResonanceDelta } from './resonate.js';
import type { Rng } from './rng.js';
import { deriveUncanny, type CreatureState, type SimEvent, type Stats } from './state.js';

export interface GatherParticipant {
  /** Stable id used to reference this creature throughout the outline. */
  id: string;
  state: CreatureState;
}

/** A small joy that passed between two creatures — flavour for the AI, no stat effect. */
export type GatherMomentTag = 'play' | 'shareAmbra' | 'mentor';

export interface GatherConnection {
  a: string;
  b: string;
  kind: 'harmony' | 'clash';
}

export interface GatherMoment {
  tag: GatherMomentTag;
  /** [a, b] — for `mentor`, the elder first then the Mote. */
  participants: [string, string];
}

export interface GatherBond {
  a: string;
  b: string;
  strength: number;
}

export interface GatherOutcome {
  id: string;
  /** Accumulated, pre-clamp deltas for the caller to apply to the stored state. */
  delta: ResonanceDelta;
  /** True for a Yim drawn back toward the light by harmonious company. */
  warmed: boolean;
  /** The brightest companion who most drew a warmed Yim out (else null). */
  comfortedById: string | null;
  /** Ids this creature harmonised with (its new/strengthened friends). */
  bondedWith: string[];
}

export interface GatherResult {
  connections: GatherConnection[];
  outcomes: GatherOutcome[];
  bonds: GatherBond[];
  moments: GatherMoment[];
  /** One journal event per participant (kind 'resonance', tag 'symposium'). */
  events: SimEvent[];
}

function addDelta(acc: { stats: Partial<Stats>; disposition: number }, d: ResonanceDelta): void {
  for (const k of Object.keys(d.stats) as (keyof Stats)[]) {
    acc.stats[k] = (acc.stats[k] ?? 0) + d.stats[k]!;
  }
  acc.disposition += d.disposition;
}

/** Small joys derived from who sat with whom — descriptive only, no stat effect. */
function deriveMoments(participants: GatherParticipant[]): GatherMoment[] {
  const moments: GatherMoment[] = [];
  for (let i = 0; i < participants.length; i++) {
    for (let j = i + 1; j < participants.length; j++) {
      const A = participants[i]!;
      const B = participants[j]!;
      const ai = STAGES.indexOf(A.state.stage);
      const bi = STAGES.indexOf(B.state.stage);
      // an elder telling a Mote how one becomes Real (the Skin Horse)
      const elderMentors = (elder: GatherParticipant, mote: GatherParticipant) =>
        STAGES.indexOf(elder.state.stage) >= GATHER.mentorEldestStageIndex &&
        elder.state.disposition >= GATHER.mentorDisposition &&
        mote.state.stage === 'mote';
      if (elderMentors(A, B)) moments.push({ tag: 'mentor', participants: [A.id, B.id] });
      else if (elderMentors(B, A)) moments.push({ tag: 'mentor', participants: [B.id, A.id] });
      // a fuller creature passing Ambra hand to hand
      else if (Math.abs(A.state.stats.ambra - B.state.stats.ambra) >= GATHER.shareAmbraGap) {
        const giver = A.state.stats.ambra >= B.state.stats.ambra ? A : B;
        const taker = giver === A ? B : A;
        moments.push({ tag: 'shareAmbra', participants: [giver.id, taker.id] });
      }
      // two bright, rested creatures simply playing
      else if (
        !deriveUncanny(A.state.disposition) &&
        !deriveUncanny(B.state.disposition) &&
        ai >= 1 &&
        bi >= 1
      ) {
        moments.push({ tag: 'play', participants: [A.id, B.id] });
      }
    }
  }
  return moments;
}

/**
 * Hold a gathering. `participants` must have at least `GATHER.minParticipants` members;
 * the caller (the API) ensures they're all one owner's creatures and already caught up.
 */
export function gather(participants: GatherParticipant[], rng: Rng): GatherResult {
  const n = participants.length;
  const ids = participants.map((p) => p.id);
  const acc = new Map(ids.map((id) => [id, { stats: {} as Partial<Stats>, disposition: 0 }]));
  const harmony = new Map(ids.map((id) => [id, [] as string[]]));
  const connections: GatherConnection[] = [];
  const bonds: GatherBond[] = [];

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const A = participants[i]!;
      const B = participants[j]!;
      const r = resonate(A.state, B.state, rng);
      const kind: GatherConnection['kind'] = r.events[0]!.tag === 'harmony' ? 'harmony' : 'clash';
      connections.push({ a: ids[i]!, b: ids[j]!, kind });
      addDelta(acc.get(ids[i]!)!, r.deltasA);
      addDelta(acc.get(ids[j]!)!, r.deltasB);
      if (kind === 'harmony') {
        harmony.get(ids[i]!)!.push(ids[j]!);
        harmony.get(ids[j]!)!.push(ids[i]!);
        bonds.push({
          a: ids[i]!,
          b: ids[j]!,
          strength: GATHER.bondStrengthBase + r.deltasA.stats.affection!,
        });
      }
    }
  }

  // Average each creature's pairwise gains across its partners (so a crowd doesn't
  // balloon the reward), then apply the small company bonus.
  const damp = GATHER.companyBonus / Math.max(1, n - 1);
  const dispositionOf = (id: string) => participants.find((p) => p.id === id)!.state.disposition;

  const outcomes: GatherOutcome[] = participants.map((p) => {
    const a = acc.get(p.id)!;
    const stats: Partial<Stats> = {};
    for (const k of Object.keys(a.stats) as (keyof Stats)[]) stats[k] = a.stats[k]! * damp;
    let disposition = a.disposition * damp;
    const partners = harmony.get(p.id)!;
    const warmed = deriveUncanny(p.state.disposition) && partners.length > 0;
    let comfortedById: string | null = null;
    if (warmed) {
      disposition += GATHER.companyComfortDisposition;
      comfortedById = partners.reduce<string | null>(
        (best, id) => (best === null || dispositionOf(id) > dispositionOf(best) ? id : best),
        null,
      );
    }
    return { id: p.id, delta: { stats, disposition }, warmed, comfortedById, bondedWith: partners };
  });

  const at = Math.max(...participants.map((p) => p.state.lastTickAt));
  const events: SimEvent[] = participants.map(() => ({
    at,
    kind: 'resonance',
    tag: 'symposium',
    statDeltas: {},
    dispositionDelta: 0,
    salience: 3,
  }));

  return { connections, outcomes, bonds, moments: deriveMoments(participants), events };
}

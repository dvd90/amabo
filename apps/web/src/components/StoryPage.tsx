/**
 * StoryPage.tsx — the Codex: a full-screen, scrollable telling of the myth (STORY.md).
 * Opened from the ❖ button. Original prose inspired by the public-domain touchstones
 * (Dante, Williams, Shelley, Plato); the lineage is theirs, the voice is ours.
 */

import type { CreatureViewT } from '@amabo/shared';
import { Creature } from './Creature.js';

function sample(disposition: number, uncanny: boolean, stage = 'bloom'): CreatureViewT {
  return {
    id: 'codex',
    name: 'codex',
    graduatedAt: null,
    lastSeenAt: null,
    createdAt: 0,
    state: {
      seed: 1,
      stage: stage as CreatureViewT['state']['stage'],
      disposition,
      ageMinutes: 0,
      stats: { ambra: 85, energy: 80, cleanliness: 100, health: 100, affection: 80, security: 80 },
      asleep: false,
      ill: false,
      uncanny,
      alive: true,
      mortality: 'soft',
      traits: {},
      careHistory: { fed: 0, cleaned: 0, played: 0, comforted: 0, neglectedSteps: 0 },
      lastTickAt: 0,
    },
  };
}

export function StoryPage({ onClose }: { onClose: () => void }) {
  return (
    <div className="codex" role="dialog" aria-label="The story of the Amarium">
      <div className="codex-sheet">
        <button className="codex-close" onClick={onClose} aria-label="Close the story">
          ✕
        </button>

        <p className="codex-kicker">The Amarium</p>
        <h1 className="codex-title">l'amor che move il sole e l'altre stelle</h1>
        <p className="codex-attr">— the love that moves the sun and the other stars (Dante)</p>

        <video className="codex-video" controls preload="metadata" poster="/og.png">
          <source src="/amabo-explainer.webm" type="video/webm" />
        </video>

        <section className="codex-section">
          <h2>Ambra — love that has to go somewhere</h2>
          <p>
            Every tenderness a person feels but never gets to land does not vanish. It drifts, and
            it pools in a sealed glass world, gathering as a warm amber light called
            <strong> Ambra</strong>. When enough collects, it condenses into a small living thing
            with no shape of its own — made of unspent love, it becomes whatever it is loved into.
          </p>
        </section>

        <section className="codex-section codex-fates">
          <div className="codex-fate">
            <div className="codex-art">
              <Creature creature={sample(80, false)} />
            </div>
            <h3>Amabo — love that landed</h3>
            <p>
              Soft, bright, curious, secure. Tended well, a creature grows radiant and content —
              even okay alone in the dark.
            </p>
          </div>
          <div className="codex-fate">
            <div className="codex-art">
              <Creature creature={sample(-70, true)} />
            </div>
            <h3>Yim — love gone unspent</h3>
            <p>
              Neglected or loved wrong, love sours into longing — an uncanny, time-broken shadow of
              the same face. Not evil; owed compassion. And never lost: comfort is the way back.
            </p>
          </div>
        </section>

        <section className="codex-section">
          <h2>The ladder, and the stars</h2>
          <p>
            A creature climbs by being loved a long time — <em>Mote → Spark → Velveteen → Bloom</em>
            . Loved fully enough, it becomes too bright for the glass and ascends into Elysium,
            leaving a named star in your sky you can always find again. Nothing is wasted; its light
            rains back as Ambra to seed the next Mote.
          </p>
        </section>

        <section className="codex-section">
          <h2>You are the Light</h2>
          <p>
            You cannot enter the glass — you can only look in, and your attention is the warmth it
            lives by. The healthiest creature is not the one that needs you every minute; it is one
            that loves you <em>and</em> is okay alone in the dark. Tend it, and read what it did and
            felt while you were away.
          </p>
        </section>

        <button className="btn btn-b codex-done" onClick={onClose}>
          Back to the glass
        </button>
      </div>
    </div>
  );
}

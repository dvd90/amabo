/**
 * PublicLook.tsx — the public keepsake page (STORY.md §7¾). Anyone with a share link
 * (/look/:token) can look into a creature's glass — read-only, no account needed. Shows
 * the creature and invites the visitor to start their own. Privacy: the postcard endpoint
 * returns only name/stage/fate, never account data, so we render a representative sprite.
 */

import type { CreatureViewT, Stage } from '@amabo/shared';
import { useEffect, useState } from 'react';
import type { PostcardView } from '../api/client.js';
import { useGame } from '../store/useGame.js';
import { Creature } from './Creature.js';

/** Build a representative sprite from the postcard's public fields (no private state). */
function representative(p: PostcardView): CreatureViewT {
  let seed = 0;
  for (const ch of p.name) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
  return {
    id: 'postcard',
    name: p.name,
    graduatedAt: p.graduated ? 1 : null,
    archivedAt: null,
    lastSeenAt: null,
    createdAt: 0,
    state: {
      seed: seed || 1,
      stage: p.stage as Stage,
      disposition: p.uncanny ? -60 : 60,
      ageMinutes: 0,
      stats: { ambra: 85, energy: 80, cleanliness: 100, health: 100, affection: 70, security: 70 },
      asleep: false,
      ill: false,
      uncanny: p.uncanny,
      alive: true,
      mortality: 'soft',
      traits: {},
      careHistory: { fed: 0, cleaned: 0, played: 0, comforted: 0, neglectedSteps: 0 },
      lastTickAt: 0,
    },
  };
}

export function PublicLook({ token }: { token: string }) {
  const client = useGame((s) => s.client);
  const [card, setCard] = useState<PostcardView | null>(null);
  const [state, setState] = useState<'loading' | 'ok' | 'gone'>('loading');

  useEffect(() => {
    void client
      .postcard(token)
      .then((c) => {
        setCard(c);
        setState('ok');
      })
      .catch(() => setState('gone'));
  }, [client, token]);

  return (
    <main className="boot">
      {state === 'loading' ? <p>Opening the glass…</p> : null}
      {state === 'gone' ? (
        <>
          <h1>Amabo</h1>
          <p>This keepsake has expired or moved.</p>
          <a className="btn btn-login" href="/">
            Begin your own
          </a>
        </>
      ) : null}
      {state === 'ok' && card ? (
        <>
          <p className="dash-kicker">Someone shared their light</p>
          <div className="postcard-art">
            <Creature creature={representative(card)} />
          </div>
          <h1>{card.name}</h1>
          <p>
            {card.graduated
              ? 'has ascended — now a star in its keeper’s sky.'
              : `a ${card.uncanny ? 'longing Yim' : 'radiant Amabo'} at the ${card.stage} stage.`}
          </p>
          <a className="btn btn-login" href="/">
            Begin your own ✦
          </a>
        </>
      ) : null}
    </main>
  );
}

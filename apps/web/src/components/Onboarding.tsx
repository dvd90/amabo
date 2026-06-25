/**
 * Onboarding.tsx — the opening: tell the myth, then let the player name and condense
 * their first Mote (STORY.md §1–4). Shown once, when a signed-in player has no creature
 * yet. The goal is to make the first thirty seconds feel like stepping into a world.
 */

import { useState } from 'react';
import { useGame } from '../store/useGame.js';

interface Beat {
  art: string;
  title: string;
  body: string;
}

const BEATS: Beat[] = [
  {
    art: '✶',
    title: 'Love has to go somewhere',
    body: 'Every tenderness a person feels but never gets to land does not vanish. It drifts, and it pools in a sealed glass world as a warm amber light called Ambra.',
  },
  {
    art: '◌',
    title: 'A Mote condenses',
    body: 'When enough Ambra gathers, it condenses into a small living thing with no shape of its own. It is made of unspent love — so it becomes whatever it is loved into.',
  },
  {
    art: '❍',
    title: 'You are the Light',
    body: 'You cannot reach into the glass. You can only look in — and your attention is the warmth it lives by. Tend it and it grows radiant: an Amabo. Neglect it and it sours into a longing Yim. Neither is a dead end; both can be loved home.',
  },
  {
    art: '✿',
    title: 'And one day, the stars',
    body: 'A creature loved fully enough becomes too bright for the glass and ascends — leaving a named star in your sky you can always find again.',
  },
];

export function Onboarding() {
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const start = useGame((s) => s.start);
  const busy = useGame((s) => s.busy);
  const naming = step >= BEATS.length;

  const condense = () => void start(name);

  return (
    <div className="onboarding" role="dialog" aria-label="Welcome to the Amarium">
      {!naming ? (
        <div className="ob-card" key={step}>
          <div className="ob-art" aria-hidden="true">
            {BEATS[step]!.art}
          </div>
          <h2>{BEATS[step]!.title}</h2>
          <p>{BEATS[step]!.body}</p>
          <div className="ob-actions">
            <span className="ob-dots" aria-hidden="true">
              {BEATS.map((_, i) => (
                <span key={i} className={i === step ? 'on' : ''}>
                  ●
                </span>
              ))}
            </span>
            <button className="btn" onClick={() => setStep(step + 1)}>
              {step === BEATS.length - 1 ? 'Begin' : 'Next'}
            </button>
          </div>
        </div>
      ) : (
        <div className="ob-card">
          <div className="ob-art ob-art-pulse" aria-hidden="true">
            ◌
          </div>
          <h2>A Mote is gathering</h2>
          <p>Give it a name to call it into being. (You can let it stay a “Mote”.)</p>
          <form
            className="ob-name"
            onSubmit={(e) => {
              e.preventDefault();
              condense();
            }}
          >
            <input
              autoFocus
              value={name}
              maxLength={24}
              placeholder="name your Mote…"
              onChange={(e) => setName(e.target.value)}
              aria-label="Creature name"
            />
            <button className="btn btn-b" type="submit" disabled={busy}>
              {busy ? 'Condensing…' : 'Condense the light ✶'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

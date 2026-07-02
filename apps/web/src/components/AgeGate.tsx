/**
 * AgeGate.tsx — the one honest question (LAUNCH_PLAN.md L2). Amabo is 13+: an AI
 * helps write the creature's inner life, so we must know the Light is old enough.
 * Shows once, right after sign-in, until a band is stated; the API refuses to
 * condense creatures until then, so this gate is enforcement, not decoration.
 */

import { useState } from 'react';
import { useGame } from '../store/useGame.js';

export function AgeGate() {
  const confirmAge = useGame((s) => s.confirmAge);
  const signOut = useGame((s) => s.signOut);
  const [young, setYoung] = useState(false);

  if (young) {
    return (
      <div className="agegate" role="dialog" aria-label="Age confirmation">
        <div className="agegate-sheet">
          <p className="intro-kicker">Before you begin</p>
          <h2 className="intro-title">The glass stays closed, for now</h2>
          <p className="agegate-lede">
            We’re sorry — Amabo is for Lights aged 13 and up. Come back when you’re older; a Mote
            will be waiting.
          </p>
          <button className="btn btn-b agegate-go" onClick={() => void signOut()}>
            Leave gently ☾
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="agegate" role="dialog" aria-label="Age confirmation">
      <div className="agegate-sheet">
        <p className="intro-kicker">Before you begin</p>
        <h2 className="intro-title">How old are you?</h2>
        <p className="agegate-lede">
          Amabo is for Lights aged <strong>13 and up</strong> — an AI helps write your creature’s
          diary, and we need to know you’re old enough to keep one.
        </p>
        <div className="agegate-bands">
          <button className="btn btn-b" onClick={() => void confirmAge('13-17')}>
            I’m 13–17
          </button>
          <button className="btn btn-b" onClick={() => void confirmAge('18+')}>
            I’m 18 or older
          </button>
        </div>
        <button className="linkish agegate-young" onClick={() => setYoung(true)}>
          I’m under 13
        </button>
        <p className="agegate-legal">
          <a href="/terms">Terms</a> · <a href="/privacy">Privacy</a>
        </p>
      </div>
    </div>
  );
}

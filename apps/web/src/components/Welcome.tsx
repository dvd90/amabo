/**
 * Welcome.tsx — the pre-signup birth moment (the funnel's front door). A logged-out visitor
 * meets an ephemeral newborn Mote — condensed by the engine, voiced by the local narrator —
 * before being asked for anything. The hook: "this little one exists right now; sign in to
 * keep it from fading." We stash its seed so signup keeps the very creature met here.
 */

import { useEffect, useState } from 'react';
import { Creature } from './Creature.js';
import { DesignSwitch } from './DesignSwitch.js';
import { useGame } from '../store/useGame.js';
import type { CreatureViewT } from '../api/client.js';

export function Welcome() {
  const client = useGame((s) => s.client);
  const showLogin = useGame((s) => s.showLogin);
  const rememberDemoSeed = useGame((s) => s.rememberDemoSeed);
  const returning = useGame((s) => s.returningVisitor);
  const [creature, setCreature] = useState<CreatureViewT | null>(null);
  const [thought, setThought] = useState<string>('');

  useEffect(() => {
    let live = true;
    void client
      .demoBirth()
      .then((d) => {
        if (!live) return;
        setCreature(d.creature);
        setThought(d.thought);
        rememberDemoSeed(d.seed); // keep this one if they sign in
      })
      .catch(() => {
        /* offline: the static intro below still stands on its own */
      });
    return () => {
      live = false;
    };
  }, [client, rememberDemoSeed]);

  return (
    <main className="app welcome">
      <p className="welcome-kicker">
        {returning ? 'It’s still here.' : 'Something is condensing…'}
      </p>
      <h1 className="welcome-title">
        {returning ? 'Your Mote is waiting' : 'A small light has gathered'}
      </h1>

      <div className="welcome-stage">
        <div className="welcome-orb">
          {creature ? <Creature creature={creature} /> : <span className="welcome-spark" />}
        </div>
      </div>

      {thought ? (
        <p className="welcome-thought">“{thought}”</p>
      ) : (
        <p className="welcome-thought welcome-thought-dim">…it is finding its first thought…</p>
      )}

      <p className="welcome-lede">
        It’s made of unspent love, with no shape of its own — it becomes whoever you love it into.
        Right now it lives only here, on this page. Sign in and it’s yours to keep, to tend, and to
        read while you’re away.
      </p>

      <button className="btn btn-b welcome-cta" onClick={showLogin}>
        {returning ? 'Keep this light ✶' : 'Keep this one ✶'}
      </button>
      <button className="linkish welcome-skip" onClick={showLogin}>
        or just sign in
      </button>
      <span className="welcome-design">
        Art style: <DesignSwitch />
      </span>
    </main>
  );
}

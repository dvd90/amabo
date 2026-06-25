/**
 * Dashboard.tsx — the roster: every amabo a Light is tending, as a wall of small glass
 * worlds. Pick one to open the device; condense a new Mote; or sign out. This is the
 * hub the app lands on after sign-in (the device is one creature deep from here).
 */

import { useState } from 'react';
import type { CreatureViewT } from '@amabo/shared';
import { Creature } from './Creature.js';
import { useGame } from '../store/useGame.js';

const STAGE_LABEL: Record<string, string> = {
  mote: 'Mote',
  spark: 'Spark',
  velveteen: 'Velveteen',
  bloom: 'Bloom',
};

function fate(c: CreatureViewT): string {
  if (!c.state.alive) return 'a fading light';
  if (c.state.uncanny) return 'Yim · longing';
  if (c.state.disposition > 20) return 'Amabo · radiant';
  return 'finding its shape';
}

function CreatureCard({ c, onOpen }: { c: CreatureViewT; onOpen: () => void }) {
  const status = [
    STAGE_LABEL[c.state.stage] ?? c.state.stage,
    c.state.asleep ? 'asleep' : null,
    c.state.ill ? 'unwell' : null,
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <button className="amabo-card" onClick={onOpen} aria-label={`Open ${c.name}`}>
      <span className="amabo-card-glass">
        <Creature creature={c} />
      </span>
      <span className="amabo-card-name">{c.name}</span>
      <span className="amabo-card-meta">{status}</span>
      <span className="amabo-card-fate">{fate(c)}</span>
    </button>
  );
}

export function Dashboard() {
  const creatures = useGame((s) => s.creatures);
  const openCreature = useGame((s) => s.openCreature);
  const start = useGame((s) => s.start);
  const signOut = useGame((s) => s.signOut);
  const busy = useGame((s) => s.busy);
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState('');

  return (
    <div className="dashboard">
      <header className="dash-top">
        <div>
          <p className="dash-kicker">Your Amarium</p>
          <h1 className="dash-title">The lights you tend</h1>
        </div>
        <button className="linkish" onClick={() => void signOut()}>
          Sign out
        </button>
      </header>

      <div className="amabo-grid">
        {creatures.map((c) => (
          <CreatureCard key={c.id} c={c} onOpen={() => void openCreature(c.id)} />
        ))}

        {naming ? (
          <form
            className="amabo-card amabo-card-new is-naming"
            onSubmit={(e) => {
              e.preventDefault();
              void start(name);
            }}
          >
            <span className="amabo-card-glass new-orb" aria-hidden="true">
              ◌
            </span>
            <input
              autoFocus
              value={name}
              maxLength={24}
              placeholder="name your Mote…"
              onChange={(e) => setName(e.target.value)}
              aria-label="New creature name"
            />
            <button className="btn btn-b" type="submit" disabled={busy}>
              {busy ? 'Condensing…' : 'Condense ✶'}
            </button>
          </form>
        ) : (
          <button
            className="amabo-card amabo-card-new"
            onClick={() => setNaming(true)}
            aria-label="Condense a new Mote"
          >
            <span className="amabo-card-glass new-orb" aria-hidden="true">
              +
            </span>
            <span className="amabo-card-name">New amabo</span>
            <span className="amabo-card-meta">condense a Mote</span>
          </button>
        )}
      </div>
    </div>
  );
}

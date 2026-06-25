/**
 * Dashboard.tsx — the roster: every amabo a Light is tending, as a wall of small glass
 * worlds. Pick one to open the device; condense a new Mote; or sign out. This is the
 * hub the app lands on after sign-in (the device is one creature deep from here).
 */

import { useState } from 'react';
import { Creature } from './Creature.js';
import { useGame } from '../store/useGame.js';
import type { NeedFlag, RosterItem } from '../api/client.js';

const STAGE_LABEL: Record<string, string> = {
  mote: 'Mote',
  spark: 'Spark',
  velveteen: 'Velveteen',
  bloom: 'Bloom',
};

/** Each urgency signal → a glyph + label + tone class for the card pip. */
const NEED: Record<NeedFlag, { glyph: string; label: string; tone: string }> = {
  ready: { glyph: '✦', label: 'ready to ascend', tone: 'good' },
  overflowing: { glyph: '✧', label: 'overflowing — can share its light', tone: 'good' },
  souring: { glyph: '☾', label: 'souring', tone: 'warn' },
  ill: { glyph: '☓', label: 'unwell', tone: 'warn' },
  hungry: { glyph: '◔', label: 'dim', tone: 'warn' },
  lonely: { glyph: '◌', label: 'lonely', tone: 'warn' },
  asleep: { glyph: 'z', label: 'asleep', tone: 'mute' },
  fading: { glyph: '·', label: 'fading', tone: 'warn' },
};

function fate(c: RosterItem): string {
  if (!c.state.alive) return 'a fading light';
  if (c.state.uncanny) return 'Yim · longing';
  if (c.state.disposition > 20) return 'Amabo · radiant';
  return 'finding its shape';
}

/** "looked in Xh ago" from the last peek (falling back to when it was condensed). */
function lastSeenLabel(c: RosterItem): string {
  const at = c.lastSeenAt ?? c.createdAt;
  const min = Math.floor((Date.now() - at) / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function CreatureCard({ c, onOpen }: { c: RosterItem; onOpen: () => void }) {
  // Sleep is informational; if the only signal is "asleep", don't raise an alarm dot.
  const urgent = c.needs.some((n) => NEED[n].tone === 'warn');
  return (
    <button
      className={`amabo-card${urgent ? ' is-urgent' : ''}`}
      onClick={onOpen}
      aria-label={`Open ${c.name}`}
    >
      <span className="amabo-card-glass">
        <Creature creature={c} />
      </span>
      <span className="amabo-card-name">{c.name}</span>
      <span className="amabo-card-meta">
        {STAGE_LABEL[c.state.stage] ?? c.state.stage} · {lastSeenLabel(c)}
      </span>
      <span className="amabo-card-fate">{fate(c)}</span>
      {c.needs.length > 0 ? (
        <span className="amabo-card-pips">
          {c.needs.map((n) => (
            <span key={n} className={`pip pip-${NEED[n].tone}`} title={NEED[n].label}>
              {NEED[n].glyph}
            </span>
          ))}
        </span>
      ) : null}
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

/**
 * Dashboard.tsx — the roster: every amabo a Light is tending, as a wall of small glass
 * worlds. Pick one to open the device; condense a new Mote; or sign out. This is the
 * hub the app lands on after sign-in (the device is one creature deep from here).
 */

import { useState } from 'react';
import { Creature } from './Creature.js';
import { useGame } from '../store/useGame.js';
import type { NeedFlag, RosterItem } from '../api/client.js';
import { enableNotifications, type EnableResult } from '../push.js';

const NOTIFY_NOTE: Record<EnableResult, string> = {
  on: '🔔 Notifications on — your lights can reach you.',
  denied: 'Notifications are blocked in your browser settings.',
  unsupported: 'This browser can’t do notifications (try installing the app).',
  unavailable: 'Notifications aren’t configured on the server yet.',
  error: 'Could not turn on notifications — try again.',
};

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

function CreatureCard({
  c,
  onOpen,
  selected = false,
  meetMode = false,
}: {
  c: RosterItem;
  onOpen: () => void;
  selected?: boolean;
  meetMode?: boolean;
}) {
  // Sleep is informational; if the only signal is "asleep", don't raise an alarm dot.
  const urgent = c.needs.some((n) => NEED[n].tone === 'warn');
  return (
    <button
      className={`amabo-card${urgent ? ' is-urgent' : ''}${selected ? ' is-selected' : ''}`}
      onClick={onOpen}
      aria-pressed={meetMode ? selected : undefined}
      aria-label={meetMode ? `Choose ${c.name} to meet` : `Open ${c.name}`}
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
  const meet = useGame((s) => s.meet);
  const client = useGame((s) => s.client);
  const incoming = useGame((s) => s.incoming);
  const acceptRehome = useGame((s) => s.acceptRehome);
  const busy = useGame((s) => s.busy);
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState('');
  const [meetMode, setMeetMode] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [note, setNote] = useState<string | null>(null);

  const exitMeet = () => {
    setMeetMode(false);
    setPicked([]);
  };

  // In meet-mode, tapping cards selects two creatures; the second pick runs the meeting.
  const onCardTap = (id: string) => {
    if (!meetMode) return void openCreature(id);
    if (picked.includes(id)) return setPicked(picked.filter((p) => p !== id));
    const next = [...picked, id];
    if (next.length < 2) return setPicked(next);
    exitMeet();
    void meet(next[0]!, next[1]!).then(setNote);
  };

  return (
    <div className="dashboard">
      <header className="dash-top">
        <div>
          <p className="dash-kicker">Your Amarium</p>
          <h1 className="dash-title">The lights you tend</h1>
        </div>
        <span className="dash-actions">
          {creatures.length >= 2 ? (
            <button
              className="linkish"
              onClick={() => {
                setNote(null);
                if (meetMode) exitMeet();
                else setMeetMode(true);
              }}
            >
              {meetMode ? 'Cancel' : '✦ Introduce two'}
            </button>
          ) : null}
          <button
            className="linkish"
            onClick={() => void enableNotifications(client).then((r) => setNote(NOTIFY_NOTE[r]))}
          >
            🔔 Notify me
          </button>
          <button className="linkish" onClick={() => void signOut()}>
            Sign out
          </button>
        </span>
      </header>

      {incoming.length > 0 ? (
        <div className="rehome-inbox">
          {incoming.map((r) => (
            <div key={r.id} className="rehome-card">
              <span>
                <strong>{r.fromEmail}</strong> wants to entrust you{' '}
                <strong>{r.creatureName}</strong>.
              </span>
              <button className="btn btn-b" onClick={() => void acceptRehome(r.id)}>
                Accept
              </button>
            </div>
          ))}
        </div>
      ) : null}

      {meetMode ? (
        <p className="dash-hint">Choose two to introduce — their Ambra will resonate.</p>
      ) : null}
      {note ? <p className="dash-note">{note}</p> : null}

      <div className="amabo-grid">
        {creatures.map((c) => (
          <CreatureCard
            key={c.id}
            c={c}
            meetMode={meetMode}
            selected={picked.includes(c.id)}
            onOpen={() => onCardTap(c.id)}
          />
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

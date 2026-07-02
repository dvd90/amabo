/**
 * Dashboard.tsx — the roster: every amabo a Light is tending, as a wall of small glass
 * worlds. Pick one to open the device; condense a new Mote; or sign out. This is the
 * hub the app lands on after sign-in (the device is one creature deep from here).
 */

import { SLOTS } from '@amabo/shared';
import { useState } from 'react';
import { Creature } from './Creature.js';
import { DuetScene } from './DuetScene.js';
import { Farewell } from './Farewell.js';
import { Introduce } from './Introduce.js';
import { Settings } from './Settings.js';
import { useGame } from '../store/useGame.js';
import type { LetterView, NeedFlag, RosterItem } from '../api/client.js';
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

function CreatureCard({ c, onOpen }: { c: RosterItem; onOpen: () => void }) {
  // Sleep is informational; if the only signal is "asleep", don't raise an alarm dot.
  const urgent = c.needs.some((n) => NEED[n].tone === 'warn');
  return (
    <button
      className={`amabo-card${urgent ? ' is-urgent' : ''}${c.state.uncanny ? ' is-yim' : ''}`}
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
  const client = useGame((s) => s.client);
  const incoming = useGame((s) => s.incoming);
  const acceptRehome = useGame((s) => s.acceptRehome);
  const openGlade = useGame((s) => s.openGlade);
  const busy = useGame((s) => s.busy);
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState('');
  const [introOpen, setIntroOpen] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [letters, setLetters] = useState<LetterView[] | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [farewell, setFarewell] = useState<RosterItem | null>(null);

  // Endings leave the shelf (STORY.md §7): the grid holds only lights being tended;
  // ended-but-unfarewelled ones wait for their ceremony; archived ones become the sky
  // shelf (ascended → their stars remain) or a quiet count (faded → Lethe).
  const active = creatures.filter((c) => c.state.alive && !c.graduatedAt && !c.archivedAt);
  const ended = creatures.filter((c) => (!c.state.alive || c.graduatedAt) && !c.archivedAt);
  const skyNames = creatures
    .filter((c) => c.graduatedAt && c.archivedAt)
    .map((c) => c.name)
    .join(' · ');
  const lostCount = creatures.filter(
    (c) => !c.state.alive && !c.graduatedAt && c.archivedAt,
  ).length;

  return (
    <div className="dashboard">
      <header className="dash-top">
        <div>
          <p className="dash-kicker">Your Amarium</p>
          <h1 className="dash-title">The lights you tend</h1>
        </div>
        <span className="dash-actions">
          <button className="linkish" onClick={() => setSettingsOpen(true)}>
            ⚙ Settings
          </button>
          {active.length >= 2 ? (
            <button
              className="linkish"
              onClick={() => {
                setNote(null);
                setIntroOpen(true);
              }}
            >
              ✦ Introduce two
            </button>
          ) : null}
          {active.length >= 2 ? (
            <button className="linkish" onClick={() => openGlade()}>
              ❀ The Symposium
            </button>
          ) : null}
          {active.length >= 2 ? (
            <button className="linkish" onClick={() => void client.letters().then(setLetters)}>
              ✉ Letters
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

      {note ? <p className="dash-note">{note}</p> : null}

      <div className="amabo-grid">
        {active.map((c) => (
          <CreatureCard key={c.id} c={c} onOpen={() => void openCreature(c.id)} />
        ))}

        {/* Ended lights awaiting their ceremony — tap to say the goodbye. */}
        {ended.map((c) => (
          <button
            key={c.id}
            className={`amabo-card amabo-card-ended${c.graduatedAt ? ' is-elysium' : ' is-lethe'}`}
            onClick={() => setFarewell(c)}
            aria-label={c.graduatedAt ? `Lay ${c.name} to rest` : `Let ${c.name} go`}
          >
            <span className="amabo-card-glass ended-mark" aria-hidden="true">
              {c.graduatedAt ? '✦' : '◌'}
            </span>
            <span className="amabo-card-name">{c.name}</span>
            <span className="amabo-card-meta">
              {c.graduatedAt ? 'ascended into Elysium' : 'its light went out'}
            </span>
            <span className="amabo-card-fate">
              {c.graduatedAt ? 'tap to lay it to rest' : 'tap to say goodbye'}
            </span>
          </button>
        ))}

        {active.length >= SLOTS.free ? (
          <div className="amabo-card amabo-card-full" aria-label="The shelf is full">
            <span className="amabo-card-glass new-orb" aria-hidden="true">
              ✦
            </span>
            <span className="amabo-card-name">The shelf is full</span>
            <span className="amabo-card-meta">it holds {SLOTS.free} lights</span>
            <span className="amabo-card-fate">a wider shelf, one day ✦</span>
          </div>
        ) : naming ? (
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

      {/* The sky shelf: the ones laid to rest live on as their stars; the faded are
          only a quiet count — Lethe keeps its own (STORY.md §7). */}
      {skyNames ? <p className="dash-shelf dash-shelf-sky">✦ in your sky: {skyNames}</p> : null}
      {lostCount > 0 ? (
        <p className="dash-shelf dash-shelf-lost">
          ◌ lost to the dark: {lostCount} light{lostCount === 1 ? '' : 's'}
        </p>
      ) : null}

      <DuetScene />
      {introOpen ? <Introduce onClose={() => setIntroOpen(false)} onDone={setNote} /> : null}
      {farewell ? <Farewell creature={farewell} onClose={() => setFarewell(null)} /> : null}
      {settingsOpen ? <Settings onClose={() => setSettingsOpen(false)} /> : null}

      {letters ? (
        <div className="letters-modal" role="dialog" aria-label="Letters between your creatures">
          <div className="letters-sheet">
            <button className="codex-close" onClick={() => setLetters(null)} aria-label="Close">
              ✕
            </button>
            <p className="codex-kicker">The pen-pal thread</p>
            {letters.length === 0 ? (
              <p className="letters-empty">
                No letters yet. Gather friends in the Symposium and they’ll begin to write.
              </p>
            ) : (
              letters.map((l) => (
                <blockquote className="letters-item" key={l.id}>
                  <span className="letters-meta">
                    {l.from} → {l.to}
                  </span>
                  {l.text}
                </blockquote>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

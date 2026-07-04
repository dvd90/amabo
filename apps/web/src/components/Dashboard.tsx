/**
 * Dashboard.tsx — the roster: every amabo a Light is tending, as a wall of small glass
 * worlds. Pick one to open the device; condense a new Mote; or sign out. This is the
 * hub the app lands on after sign-in (the device is one creature deep from here).
 */

import { SLOTS } from '@amabo/shared';
import { useEffect, useState } from 'react';
import { Creature } from './Creature.js';
import { DuetScene } from './DuetScene.js';
import { Farewell } from './Farewell.js';
import { Introduce } from './Introduce.js';
import { Settings } from './Settings.js';
import { useGame } from '../store/useGame.js';
import type { ChronicleView, LetterView, NeedFlag, PulseView, RosterItem } from '../api/client.js';
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

/** The glass's own clock-words — a timestamp that sounds inhabited (M-L). */
export function timeWord(at: number): string {
  const h = new Date(at).getHours();
  if (h < 5) return 'in the small hours';
  if (h < 8) return 'at first light';
  if (h < 12) return 'in the morning';
  if (h < 17) return 'in the afternoon';
  if (h < 21) return 'at dusk';
  return 'in the evening';
}

/** The chosen day, in plain words (tags from the engine's daypath pools). */
const DAYPATH_PHRASE: Record<string, string> = {
  keptWarmCorner: 'chose to keep the warm corner',
  watchedGlass: 'chose to watch the light cross the glass',
  triedAShape: 'spent the dark practising a new shape',
  sortedSmallThings: 'sorted its small things',
  hummedToItself: 'hummed a tune of its own',
  builtSmallThing: 'built a small thing to show you',
  tendedMoss: 'tended the moss till it stood up',
  keptWelcome: 'kept a welcome ready by the door',
  rounderShape: 'practised being rounder, kinder',
  sangToGlass: 'sang quietly to the glass',
  countedHours: 'counted the hours, twice',
  stoppedClock: 'kept the stopped clock company',
  waitedByDoor: 'waited where the light comes in',
  listenedLatch: 'listened for the latch',
  tidiedDark: 'tidied a corner of the dark',
};

/** One line of recent LIFE per card — the proof this is a world, not a database. */
function liveLine(
  c: RosterItem,
  day: { tag: string; at: number } | null | undefined,
): string | null {
  if (!c.state.alive) return null;
  if (day && DAYPATH_PHRASE[day.tag]) return `${DAYPATH_PHRASE[day.tag]} ${timeWord(day.at)}`;
  if (c.state.asleep) return `asleep, holding its warm spot`;
  if (c.manner) return `keeps the ${c.manner.haunt.replace('-', ' ')} · ${c.manner.ritual}`;
  return null;
}

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
  day,
}: {
  c: RosterItem;
  onOpen: () => void;
  day?: { tag: string; at: number } | null;
}) {
  // Sleep is informational; if the only signal is "asleep", don't raise an alarm dot.
  const urgent = c.needs.some((n) => NEED[n].tone === 'warn');
  const live = liveLine(c, day);
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
      {live ? <span className="amabo-card-live">{live}</span> : null}
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
  const tier = useGame((s) => s.tier);
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState('');
  const [introOpen, setIntroOpen] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [letters, setLetters] = useState<LetterView[] | null>(null);
  const [chronicle, setChronicle] = useState<ChronicleView | null>(null);
  const [pulse, setPulse] = useState<PulseView | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [farewell, setFarewell] = useState<RosterItem | null>(null);

  // Endings leave the shelf (STORY.md §7): the grid holds only lights being tended;
  // ended-but-unfarewelled ones wait for their ceremony; archived ones become the sky
  // shelf (ascended → their stars remain) or a quiet count (faded → Lethe).
  const active = creatures.filter((c) => c.state.alive && !c.graduatedAt && !c.archivedAt);

  // The living-world glance (M-L): what happened while the Light was away.
  useEffect(() => {
    if (creatures.length > 0)
      void client
        .pulse?.()
        .then(setPulse)
        .catch(() => {});
  }, [creatures.length]);
  const dayOf = new Map((pulse?.lives ?? []).map((l) => [l.id, l.daypath]));

  // The away-digest banner: up to three lines of proof the world kept turning.
  const digest: string[] = [];
  if (pulse) {
    for (const l of pulse.lives) {
      const c = active.find((x) => x.id === l.id);
      if (c && l.daypath && DAYPATH_PHRASE[l.daypath.tag] && digest.length < 2) {
        digest.push(`${c.name} ${DAYPATH_PHRASE[l.daypath.tag]} ${timeWord(l.daypath.at)}`);
      }
    }
    if (pulse.latest) {
      digest.push(
        pulse.chronicleNew > 1
          ? `${pulse.latest.aName} & ${pulse.latest.bName} met — and ${pulse.chronicleNew - 1} more page${pulse.chronicleNew > 2 ? 's' : ''} in the Chronicle`
          : `${pulse.latest.aName} & ${pulse.latest.bName} met ${timeWord(pulse.latest.at)}`,
      );
    }
  }
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
          {active.length >= 2 ? (
            <button
              className="linkish"
              onClick={() =>
                void client.chronicle().then((book) => {
                  setChronicle(book);
                  setPulse((prev) => (prev ? { ...prev, chronicleNew: 0 } : prev));
                })
              }
            >
              📖 The Chronicle
              {pulse && pulse.chronicleNew > 0 ? (
                <span className="chronicle-badge"> · {pulse.chronicleNew} new</span>
              ) : null}
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

      {digest.length > 0 ? (
        <div className="away-digest" role="status">
          <p className="away-digest-kicker">While you were away, the glass kept turning ☾</p>
          <ul className="away-digest-lines">
            {digest.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="amabo-grid">
        {active.map((c) => (
          <CreatureCard
            key={c.id}
            c={c}
            day={dayOf.get(c.id)}
            onOpen={() => void openCreature(c.id)}
          />
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

        {active.length >= (tier === 'lantern' ? SLOTS.lantern : SLOTS.free) ? (
          <div className="amabo-card amabo-card-full" aria-label="The shelf is full">
            <span className="amabo-card-glass new-orb" aria-hidden="true">
              ✦
            </span>
            <span className="amabo-card-name">The shelf is full</span>
            <span className="amabo-card-meta">
              it holds {tier === 'lantern' ? SLOTS.lantern : SLOTS.free} lights
            </span>
            <span className="amabo-card-fate">
              {tier === 'lantern'
                ? 'lay a light to rest to make room ✦'
                : 'a wider shelf, one day ✦'}
            </span>
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

      {chronicle ? (
        <div className="letters-modal" role="dialog" aria-label="The Chronicle of your shelf">
          <div className="letters-sheet">
            <button className="codex-close" onClick={() => setChronicle(null)} aria-label="Close">
              ✕
            </button>
            <p className="codex-kicker">The Chronicle — what the shelf remembers</p>
            {chronicle.entries.length === 0 ? (
              <p className="letters-empty">
                No pages yet. Leave two or more lights together a while — the glass will bring them
                together, and the shelf will write it down.
              </p>
            ) : (
              chronicle.entries.map((e, i) => (
                <blockquote
                  className={`letters-item chronicle-entry chronicle-${e.valence}`}
                  key={`${e.at}-${i}`}
                >
                  <span className="letters-meta">
                    {e.aName} · {e.bName} {e.valence === 'strained' ? '· a small friction' : ''}
                  </span>
                  {e.text}
                </blockquote>
              ))
            )}
            {chronicle.standings.length > 0 ? (
              <>
                <p className="codex-kicker chronicle-standings-title">How things stand</p>
                {chronicle.standings.map((st, i) => (
                  <p className="chronicle-standing" key={`${st.updatedAt}-${i}`}>
                    <span className="letters-meta">
                      {st.aName} &amp; {st.bName}
                    </span>{' '}
                    {st.line}
                  </p>
                ))}
              </>
            ) : null}
          </div>
        </div>
      ) : null}

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

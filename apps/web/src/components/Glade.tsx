/**
 * Glade.tsx — the Symposium (STORY.md §6½). Choose 2–6 of your creatures and gather them
 * in a shared glade; read the conversation they had about love, and what it did to them.
 * By mutual consent the glade can open between worlds (§6¾): bring a friend's creature in
 * as a guest with their 'gather' pass, or lend one of yours by copying a pass to send.
 * The engine + AI did the work server-side; this only lets you pick, then renders the
 * returned scene (the creatures together) + transcript + outcomes.
 */

import { useState } from 'react';
import { Creature } from './Creature.js';
import { SymposiumScene } from './SymposiumScene.js';
import { FriendshipSky } from './FriendshipSky.js';
import { useGame } from '../store/useGame.js';
import type { SkyView } from '../api/client.js';

const MIN = 2;
const MAX = 8;
const TOPICS = ['love', 'the dark', 'becoming Real', 'home', 'the Light'] as const;

/** Pull the capability token out of a pasted guest-pass link (or accept a raw token). */
function passToToken(s: string): string | null {
  const t = s.trim();
  if (!t) return null;
  const m = t.match(/\/look\/([^/?#\s]+)/);
  return m ? m[1]! : (t.split(/[?#\s]/)[0] ?? null) || null;
}

export function Glade() {
  const roster = useGame((s) => s.creatures);
  // Only lights still being tended can gather (the ended have left the shelf).
  const creatures = roster.filter((c) => c.state.alive && !c.graduatedAt && !c.archivedAt);
  const gathering = useGame((s) => s.gathering);
  const busy = useGame((s) => s.busy);
  const hold = useGame((s) => s.holdSymposium);
  const close = useGame((s) => s.closeGlade);
  const mintPass = useGame((s) => s.mintGuestPass);
  const client = useGame((s) => s.client);
  const [picked, setPicked] = useState<string[]>([]);
  const [topic, setTopic] = useState<string | null>(null);
  const [sky, setSky] = useState<SkyView | null>(null);
  const [showGuests, setShowGuests] = useState(false);
  const [guestText, setGuestText] = useState('');
  const [copied, setCopied] = useState<string | null>(null);

  const toggle = (id: string) =>
    setPicked((p) =>
      p.includes(id) ? p.filter((x) => x !== id) : p.length < MAX ? [...p, id] : p,
    );

  const guestTokens = guestText
    .split(/[\n,]/)
    .map(passToToken)
    .filter((t): t is string => !!t);

  const lend = async (id: string, name: string) => {
    const url = await mintPass(id);
    if (!url) return;
    try {
      await navigator.clipboard?.writeText(url);
      setCopied(name);
      setTimeout(() => setCopied(null), 2200);
    } catch {
      // No clipboard (or denied) — fall back to showing the link to copy by hand.
      setGuestText((g) => (g ? g : `# share this with a friend:\n${url}`));
    }
  };

  // A held gathering plays as an animated scene (which also renders the summary at the end).
  if (gathering) return <SymposiumScene gathering={gathering} />;

  const total = picked.length + guestTokens.length;

  // ── Choosing who gathers ───────────────────────────────────────────────────────
  return (
    <div className="glade">
      <div className="glade-top">
        <button className="toggle" onClick={close} aria-label="Back to all your amabos">
          ◂ all
        </button>
        <span className="glade-title">the Symposium</span>
        <button className="linkish" onClick={() => void client.sky().then(setSky)}>
          ✦ the sky
        </button>
      </div>
      <p className="glade-lede">
        Gather {MIN}–{MAX} of your creatures in the glade to be together and speak of love.
      </p>
      {/* The glade's purpose made visible: company is grace (STORY.md §6½) — a longing
          Yim warmed by warm companions drifts back toward the light. */}
      {creatures.some((c) => c.state.uncanny) ? (
        <p className="glade-purpose">
          ☾{' '}
          {creatures
            .filter((c) => c.state.uncanny)
            .map((c) => c.name)
            .join(', ')}{' '}
          is longing — company is grace. Gather bright friends around it.
        </p>
      ) : null}

      <div className="glade-roster">
        {creatures.map((c) => {
          const on = picked.includes(c.id);
          return (
            <button
              key={c.id}
              className={`glade-pick${on ? ' is-on' : ''}`}
              aria-pressed={on}
              onClick={() => toggle(c.id)}
            >
              <span className="glade-pick-art">
                <Creature creature={c} />
              </span>
              <span className="glade-pick-name">{c.name}</span>
            </button>
          );
        })}
      </div>

      <p className="glade-topic-lede">Speak of…</p>
      <div className="glade-topics">
        {TOPICS.map((t) => (
          <button
            key={t}
            className={`glade-topic${topic === t ? ' is-on' : ''}`}
            aria-pressed={topic === t}
            onClick={() => setTopic((cur) => (cur === t ? null : t))}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="glade-guests">
        <button
          className="linkish glade-guests-toggle"
          aria-expanded={showGuests}
          onClick={() => setShowGuests((v) => !v)}
        >
          {showGuests ? '▾' : '▸'} between worlds — bring or lend a guest
          {guestTokens.length ? ` (${guestTokens.length} coming)` : ''}
        </button>
        {showGuests ? (
          <div className="glade-guests-body">
            <p className="glade-guests-note">
              Paste a friend’s guest passes (one per line) to bring their creatures into your glade.
              By mutual consent only — a friendship across worlds.
            </p>
            <textarea
              className="glade-guests-input"
              rows={3}
              placeholder="https://…/look/…?k=gather"
              value={guestText}
              onChange={(e) => setGuestText(e.target.value)}
              aria-label="Guest passes"
            />
            <p className="glade-guests-note">Or lend one of yours — copy a pass to send:</p>
            <div className="glade-guests-lend">
              {creatures.map((c) => (
                <button
                  key={c.id}
                  className="chip glade-lend"
                  onClick={() => void lend(c.id, c.name)}
                >
                  {copied === c.name ? '✓ copied' : `pass · ${c.name}`}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <button
        className="btn btn-b glade-gather"
        disabled={picked.length < 1 || total < MIN || busy}
        onClick={() => void hold(picked, topic ?? undefined, guestTokens)}
      >
        {busy ? 'Gathering…' : `Gather ${total || ''} ✦`}
      </button>

      {sky ? <FriendshipSky sky={sky} onClose={() => setSky(null)} /> : null}
    </div>
  );
}

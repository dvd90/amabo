/**
 * ShareCardButton.tsx — turn the open creature's diary entry into a shareable image (GTM #3).
 * Renders the creature's real SVG offscreen, serialises it, and hands it to the canvas card
 * renderer, then to the Web Share API (or a download). Two framings from one routine: a 9:16
 * Story for Reels/TikTok and a 1:1 Square for Reddit/PH/X.
 */

import { useRef, useState } from 'react';
import { Creature } from './Creature.js';
import { useGame } from '../store/useGame.js';
import {
  cardFilename,
  renderCardBlob,
  shareOrSaveCard,
  type CardFormat,
} from '../share/shareCard.js';

export function ShareCardButton() {
  const creature = useGame((s) => s.creature);
  const journal = useGame((s) => s.lastJournal);
  const mood = useGame((s) => s.mood);
  const holderRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Nothing to share until there's an entry to read.
  if (!creature || !journal) return null;

  const make = async (format: CardFormat) => {
    const svgEl = holderRef.current?.querySelector('svg');
    if (!svgEl) return;
    setBusy(true);
    setStatus(null);
    try {
      const svg = new XMLSerializer().serializeToString(svgEl);
      const blob = await renderCardBlob(svg, {
        name: creature.name,
        journal,
        mood: mood ?? 'content',
        uncanny: creature.state.uncanny,
        stage: creature.state.stage,
        format,
      });
      if (!blob) {
        setStatus('couldn’t make the card here');
        return;
      }
      const where = await shareOrSaveCard(
        blob,
        cardFilename(creature.name, format),
        `${creature.name} — from the Amarium`,
      );
      setStatus(where === 'shared' ? 'shared ✦' : 'saved to your device ✦');
    } catch {
      setStatus('couldn’t share just now');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="sharecard">
      <p className="sharecard-lede">Share this entry</p>
      <div className="sharecard-row">
        <button className="sharecard-btn" disabled={busy} onClick={() => void make('story')}>
          ✦ Story
        </button>
        <button className="sharecard-btn" disabled={busy} onClick={() => void make('square')}>
          ✦ Square
        </button>
      </div>
      {status ? <p className="sharecard-status">{status}</p> : null}
      {/* offscreen source art for rasterising onto the card */}
      <div ref={holderRef} className="sharecard-src" aria-hidden="true">
        <Creature creature={creature} />
      </div>
    </div>
  );
}

/**
 * Farewell.tsx — laying an ended light to rest (STORY.md §7 "Endings leave the shelf").
 * Two moods for two endings: an ASCENDED creature is laid to rest warmly — its named
 * star remains in your sky (Mnemosyne); a FADED one is let go quietly into the dark
 * between stars (Lethe). The confirm archives it: off the active shelf, never deleted.
 */

import { useGame } from '../store/useGame.js';
import type { RosterItem } from '../api/client.js';

export function Farewell({ creature, onClose }: { creature: RosterItem; onClose: () => void }) {
  const layToRest = useGame((s) => s.layToRest);
  const ascended = creature.graduatedAt !== null;

  const confirm = async () => {
    await layToRest(creature.id);
    onClose();
  };

  return (
    <div
      className={`farewell${ascended ? ' is-elysium' : ' is-lethe'}`}
      role="dialog"
      aria-label={ascended ? 'Lay to rest' : 'Let it go'}
      onClick={onClose}
    >
      <div className="farewell-sheet" onClick={(e) => e.stopPropagation()}>
        <p className="farewell-kicker">{ascended ? 'Mnemosyne — kept' : 'Lethe — the quiet'}</p>
        <div className="farewell-mark" aria-hidden="true">
          {ascended ? '✦' : '◌'}
        </div>
        <h2 className="farewell-name">{creature.name}</h2>
        {ascended ? (
          <p className="farewell-line">
            It is already in your sky — a named star you can always find. Lay the empty glass to
            rest; the light itself is kept.
          </p>
        ) : (
          <p className="farewell-line">
            Its light went out in the dark. Let the glass go quiet — what it was, you carry; the
            dark between stars keeps its own.
          </p>
        )}
        <button className="btn btn-b farewell-confirm" onClick={() => void confirm()}>
          {ascended ? 'Lay it to rest ✦' : 'Let it go ◌'}
        </button>
        <button className="linkish farewell-cancel" onClick={onClose}>
          not yet
        </button>
      </div>
    </div>
  );
}

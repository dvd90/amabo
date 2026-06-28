/**
 * FriendshipSky.tsx — the lasting constellation of every bond your creatures have formed
 * across all gatherings (STORY.md §6½). Each bonded creature is a star on a ring; the
 * threads between them brighten and thicken with the strength of the friendship.
 */

import type { SkyView } from '../api/client.js';

export function FriendshipSky({ sky, onClose }: { sky: SkyView; onClose: () => void }) {
  const n = sky.stars.length;
  // Place the stars evenly on a ring (deterministic by index).
  const pos = (i: number) => {
    const a = (i / Math.max(1, n)) * Math.PI * 2 - Math.PI / 2;
    return { x: 50 + Math.cos(a) * 36, y: 50 + Math.sin(a) * 36 };
  };
  const idx = new Map(sky.stars.map((s, i) => [s.id, i]));
  const maxStrength = Math.max(1, ...sky.threads.map((t) => t.strength));

  return (
    <div className="sky-modal" role="dialog" aria-label="The friendship sky" onClick={onClose}>
      <div className="sky-sheet" onClick={(e) => e.stopPropagation()}>
        <button className="codex-close" onClick={onClose} aria-label="Close">
          ✕
        </button>
        <p className="codex-kicker">The friendship sky</p>

        {n === 0 ? (
          <p className="sky-empty">
            No friendships yet. Gather your creatures in the Symposium and the bonds they form will
            hang here as stars.
          </p>
        ) : (
          <svg className="sky-svg" viewBox="0 0 100 100" aria-hidden="true">
            {sky.threads.map((t, i) => {
              const a = idx.get(t.a);
              const b = idx.get(t.b);
              if (a === undefined || b === undefined) return null;
              const pa = pos(a);
              const pb = pos(b);
              return (
                <line
                  key={i}
                  x1={pa.x}
                  y1={pa.y}
                  x2={pb.x}
                  y2={pb.y}
                  className="sky-thread"
                  style={{
                    strokeWidth: 0.4 + 1.2 * (t.strength / maxStrength),
                    opacity: 0.35 + 0.5 * (t.strength / maxStrength),
                  }}
                />
              );
            })}
            {sky.stars.map((s, i) => {
              const p = pos(i);
              return (
                <g key={s.id}>
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={2.6}
                    className={`sky-star${s.uncanny ? ' is-yim' : ''}`}
                  />
                  <text x={p.x} y={p.y + 6} className="sky-label">
                    {s.name}
                  </text>
                </g>
              );
            })}
          </svg>
        )}
      </div>
    </div>
  );
}

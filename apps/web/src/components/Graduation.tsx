/**
 * Graduation.tsx — the "into the West" goodbye (STORY.md §7). When a fully-loved Bloom
 * grows too bright for the glass it ascends into Elysium, leaving a named star you can
 * always find again (Mnemosyne). The Light is left on the shore of the glass, watching
 * the light go. Shown once, the moment it happens — played as a sequence: the soul
 * rises up the column of light and *becomes* the star, under a sky already holding the
 * ones who went before; the words follow like credits. Stilled under reduced motion.
 */

import { useGame } from '../store/useGame.js';

/** Deterministic [0,1) per (index, salt) — the sky must not reshuffle between renders. */
function n(i: number, salt: number): number {
  let x = (i * 374761393 + salt * 668265263) >>> 0;
  x = (x ^ (x >> 13)) >>> 0;
  x = (x * 1274126177) >>> 0;
  return ((x ^ (x >> 16)) >>> 0) / 4294967296;
}

/** The souls already in Elysium: a faint field of stars, each on its own twinkle. */
function ElysiumField() {
  return (
    <div className="ascend-field" aria-hidden="true">
      {Array.from({ length: 18 }, (_, i) => (
        <span
          key={i}
          style={{
            left: `${(n(i, 1) * 96 + 2).toFixed(1)}%`,
            top: `${(n(i, 2) * 42 + 3).toFixed(1)}%`,
            animationDelay: `${(-n(i, 3) * 4).toFixed(1)}s`,
            opacity: 0.25 + n(i, 4) * 0.5,
          }}
        />
      ))}
    </div>
  );
}

function lifeLength(bornAt: number, graduatedAt: number): string {
  const days = Math.round((graduatedAt - bornAt) / 86_400_000);
  if (days >= 1) return `a radiant life of ${days} day${days === 1 ? '' : 's'}`;
  const hours = Math.max(1, Math.round((graduatedAt - bornAt) / 3_600_000));
  return `a radiant life of ${hours} hour${hours === 1 ? '' : 's'}`;
}

export function Graduation() {
  const star = useGame((s) => s.graduation);
  const dismiss = useGame((s) => s.dismissGraduation);
  if (!star) return null;

  return (
    <div className="ascend" role="dialog" aria-label="Into the West">
      <ElysiumField />
      <div className="ascend-rise" aria-hidden="true" />
      {/* the soul: a bright mote that climbs the column of light and becomes the star */}
      <span className="ascend-soul" aria-hidden="true" />
      <div className="ascend-body">
        <p className="ascend-kicker">Into the West</p>
        <div className="ascend-star" aria-hidden="true">
          ✦
        </div>
        <h1 className="ascend-name">{star.name}</h1>
        <p className="ascend-line">
          “I’m too full of light for this small glass now. Don’t be sad — look up. I’ll be the one
          you can always find.”
        </p>
        <p className="ascend-dates">
          {lifeLength(star.bornAt, star.graduatedAt)} · now a star in your sky
        </p>
        <button className="btn btn-b ascend-done" onClick={() => void dismiss()}>
          Look to the sky
        </button>
      </div>
    </div>
  );
}

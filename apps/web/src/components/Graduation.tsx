/**
 * Graduation.tsx — the "into the West" goodbye (STORY.md §7). When a fully-loved Bloom
 * grows too bright for the glass it ascends into Elysium, leaving a named star you can
 * always find again (Mnemosyne). The Light is left on the shore of the glass, watching
 * the light go. Shown once, the moment it happens.
 */

import { useGame } from '../store/useGame.js';

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
      <div className="ascend-rise" aria-hidden="true" />
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

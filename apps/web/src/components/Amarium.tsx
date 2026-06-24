/**
 * Amarium.tsx — the LCD: a dot-matrix amber world whose glow tracks ambient Ambra
 * (STORY.md §3, ARCHITECTURE.md §10). Scanlines + faint tint; the creature sprite is
 * stage × disposition. Respects prefers-reduced-motion via CSS.
 */

import type { CreatureViewT } from '@amabo/shared';
import { glow, spriteFor } from './sprite.js';

export function Amarium({ creature }: { creature: CreatureViewT | null }) {
  const intensity = creature ? glow(creature) : 0.05;
  return (
    <div
      className="amarium"
      role="img"
      aria-label={
        creature
          ? `${creature.name}, a ${creature.state.uncanny ? 'Yim' : 'Amabo'} at the ${creature.state.stage} stage`
          : 'an empty, dark Amarium'
      }
      style={{ ['--ambra' as string]: intensity.toFixed(3) }}
    >
      <div className="amarium-glow" />
      <div className="amarium-sprite">{creature ? spriteFor(creature) : '·'}</div>
      <div className="amarium-scanlines" aria-hidden="true" />
    </div>
  );
}

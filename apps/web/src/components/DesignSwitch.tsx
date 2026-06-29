/**
 * DesignSwitch.tsx — a plainly-labelled toggle between the two creature art styles
 * (Smooth ⟷ Pixel). It just flips the store's pixelMode flag; because <Creature>
 * delegates on that flag, the whole app re-renders in the chosen style (roster, device,
 * glade, the share card, the welcome Mote). Default is Smooth; the choice persists.
 */

import { useGame } from '../store/useGame.js';

export function DesignSwitch() {
  const pixelMode = useGame((s) => s.pixelMode);
  const togglePixel = useGame((s) => s.togglePixel);
  return (
    <span className="design-switch" role="group" aria-label="Creature art style">
      <button
        type="button"
        className={`design-opt${!pixelMode ? ' is-on' : ''}`}
        aria-pressed={!pixelMode}
        onClick={() => {
          if (pixelMode) togglePixel();
        }}
      >
        ✶ Smooth
      </button>
      <button
        type="button"
        className={`design-opt${pixelMode ? ' is-on' : ''}`}
        aria-pressed={pixelMode}
        onClick={() => {
          if (!pixelMode) togglePixel();
        }}
      >
        ▦ Pixel
      </button>
    </span>
  );
}

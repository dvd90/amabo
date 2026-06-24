/**
 * Device.tsx — the molded shell: a screen cutout, the Amarium, and THREE physical
 * buttons (A select · B confirm · C back). Button-only navigation is the Tamagotchi
 * feel. Keyboard a11y maps A/B/C (and arrows) to the buttons; visible focus + a
 * high-contrast text line below the LCD (ARCHITECTURE.md §10).
 */

import { useEffect } from 'react';
import { Amarium } from './Amarium.js';
import { Screen } from './Screen.js';
import { useGame, type Screen as ScreenName } from '../store/useGame.js';

export function Device() {
  const { creature, screen, next, confirm, back, busy } = useGame();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === 'a' || k === 'arrowright') void next();
      else if (k === 'b' || k === 'enter' || k === ' ') void confirm();
      else if (k === 'c' || k === 'escape' || k === 'arrowleft') void back();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [next, confirm, back]);

  return (
    <div className="device" data-screen={screen}>
      <div className="device-brand">amabo</div>
      <div className="device-bezel">
        <Amarium creature={creature} />
      </div>
      <div className="device-readout">
        <Screen />
      </div>
      <div className="device-screenname" aria-live="polite">
        {labelFor(screen)} {busy ? '⏳' : ''}
      </div>
      <div className="device-buttons">
        <button className="btn btn-a" onClick={() => next()} aria-label="A: next screen">
          A ▸
        </button>
        <button className="btn btn-b" onClick={() => void confirm()} aria-label="B: confirm">
          ●
        </button>
        <button className="btn btn-c" onClick={() => back()} aria-label="C: back">
          ◂ C
        </button>
      </div>
      <p className="device-help">A cycles · ● acts · C goes home</p>
    </div>
  );
}

function labelFor(s: ScreenName): string {
  return s[0]!.toUpperCase() + s.slice(1);
}

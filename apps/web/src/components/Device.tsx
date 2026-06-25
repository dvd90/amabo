/**
 * Device.tsx — the molded shell: a screen cutout, the Amarium, and THREE physical
 * buttons (A select · B confirm · C back). Button-only navigation is the Tamagotchi
 * feel. Keyboard a11y maps A/B/C (and arrows) to the buttons; visible focus + a
 * high-contrast text line below the LCD (ARCHITECTURE.md §10).
 */

import { useEffect } from 'react';
import { Amarium } from './Amarium.js';
import { Screen } from './Screen.js';
import { blip, setAmbient } from '../audio.js';
import { useGame, type Screen as ScreenName } from '../store/useGame.js';

export function Device() {
  const {
    creature,
    screen,
    next,
    confirm,
    back,
    busy,
    muted,
    toggleMute,
    highContrast,
    toggleContrast,
  } = useGame();

  const withBlip = (fn: () => void | Promise<void>) => () => {
    blip(muted);
    // Browsers only allow audio after a gesture — start the ambient pad on first press.
    if (!muted) setAmbient(true);
    void fn();
  };

  const onToggleMute = () => {
    setAmbient(muted); // muted is the *old* value → if it was muted, turn sound on
    toggleMute();
  };

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
    <div className={`device${highContrast ? ' hc' : ''}`} data-screen={screen}>
      <div className="device-topbar">
        <span className="device-brand">amabo</span>
        <span className="device-toggles">
          <button
            className="toggle"
            onClick={onToggleMute}
            aria-pressed={muted}
            aria-label={muted ? 'Unmute sound + music' : 'Mute sound + music'}
          >
            {muted ? '🔇' : '🔊'}
          </button>
          <button
            className="toggle"
            onClick={() => toggleContrast()}
            aria-pressed={highContrast}
            aria-label="Toggle high-contrast text mode"
          >
            Aa
          </button>
        </span>
      </div>
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
        <button className="btn btn-a" onClick={withBlip(next)} aria-label="A: next screen">
          A ▸
        </button>
        <button className="btn btn-b" onClick={withBlip(confirm)} aria-label="B: confirm">
          ●
        </button>
        <button className="btn btn-c" onClick={withBlip(back)} aria-label="C: back">
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

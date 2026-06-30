/**
 * Settings.tsx — a small appearance panel (a modal "tab"). Two reversible, persisted
 * preferences: the colour Theme (retints the UI accent) and the creature Art style
 * (smooth ⟷ pixel). Both apply app-wide instantly; nothing here touches game state.
 */

import { DesignSwitch } from './DesignSwitch.js';
import { THEMES, useGame } from '../store/useGame.js';

export function Settings({ onClose }: { onClose: () => void }) {
  const theme = useGame((s) => s.theme);
  const setTheme = useGame((s) => s.setTheme);

  return (
    <div className="settings-modal" role="dialog" aria-label="Settings" onClick={onClose}>
      <div className="settings-sheet" onClick={(e) => e.stopPropagation()}>
        <button className="codex-close" onClick={onClose} aria-label="Close">
          ✕
        </button>
        <p className="codex-kicker">Settings · Appearance</p>

        <h3 className="settings-h">Theme</h3>
        <div className="settings-themes" role="group" aria-label="Colour theme">
          {THEMES.map((t) => (
            <button
              key={t.id}
              className={`theme-swatch${theme === t.id ? ' is-on' : ''}`}
              aria-pressed={theme === t.id}
              onClick={() => setTheme(t.id)}
            >
              <span className="theme-dot" style={{ background: t.swatch }} aria-hidden="true" />
              {t.label}
            </button>
          ))}
        </div>

        <h3 className="settings-h">Creature art</h3>
        <DesignSwitch />

        <p className="settings-note">Saved to your account — follows you to any device.</p>
      </div>
    </div>
  );
}

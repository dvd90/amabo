/**
 * Settings.tsx — a small appearance panel (a modal "tab"). Two reversible, persisted
 * preferences: the colour Theme (retints the UI accent) and the creature Art style
 * (smooth ⟷ pixel). Both apply app-wide instantly; nothing here touches game state.
 */

import { useState } from 'react';
import { DesignSwitch } from './DesignSwitch.js';
import { THEMES, useGame } from '../store/useGame.js';

export function Settings({ onClose }: { onClose: () => void }) {
  const theme = useGame((s) => s.theme);
  const setTheme = useGame((s) => s.setTheme);
  const deleteAccount = useGame((s) => s.deleteAccount);
  const [deleting, setDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState('');

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

        <h3 className="settings-h">The small print</h3>
        <p className="settings-legal">
          <a href="/terms">Terms</a> · <a href="/privacy">Privacy</a> ·{' '}
          <a href="mailto:dvdsellam@gmail.com?subject=Amabo">contact</a>
        </p>

        <h3 className="settings-h settings-h-danger">Leave the Amarium</h3>
        {deleting ? (
          <div className="settings-delete">
            <p className="settings-delete-warn">
              This erases your account and every creature, journal and friendship in it —
              immediately and forever. Type your account email to confirm.
            </p>
            <input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="you@example.com"
              aria-label="Type your email to confirm deletion"
            />
            <button
              className="btn btn-b settings-delete-go"
              disabled={confirmText.trim() === ''}
              onClick={() => void deleteAccount(confirmText.trim())}
            >
              Let it all go ◌
            </button>
            <button className="linkish" onClick={() => setDeleting(false)}>
              Keep my lights
            </button>
          </div>
        ) : (
          <button className="linkish settings-delete-open" onClick={() => setDeleting(true)}>
            Delete my account…
          </button>
        )}
        <p className="settings-build">build {(import.meta.env.VITE_COMMIT ?? 'dev').slice(0, 7)}</p>
      </div>
    </div>
  );
}

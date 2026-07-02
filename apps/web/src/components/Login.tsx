/**
 * Login.tsx — the threshold. Passwordless email sign-in is the primary path (one field,
 * works everywhere); "Continue with Google" appears only when the server has Google
 * configured. If an OAuth round-trip failed, the API redirects back here with an
 * `?auth_error=…` flag, which we show instead of leaving the user on a blank page.
 */

import { useEffect, useState } from 'react';
import { LOGIN_URL } from '../api/client.js';
import { useGame } from '../store/useGame.js';

const AUTH_ERRORS: Record<string, string> = {
  google: 'Google sign-in failed. Please try again, or continue with email.',
  state: 'That sign-in link expired. Please try again.',
  link: 'That sign-in link is invalid or has expired. Request a fresh one below.',
  access_denied: 'Google sign-in was cancelled.',
};

function readAuthError(): string | null {
  if (typeof window === 'undefined') return null;
  const code = new URLSearchParams(window.location.search).get('auth_error');
  if (!code) return null;
  // Clean the flag out of the URL so a refresh doesn't keep showing it.
  window.history.replaceState({}, '', window.location.pathname);
  return AUTH_ERRORS[code] ?? 'Sign-in failed. Please try again.';
}

export function Login() {
  const client = useGame((s) => s.client);
  const signInWithEmail = useGame((s) => s.signInWithEmail);
  const magicSent = useGame((s) => s.magicSent);
  const magicDevLink = useGame((s) => s.magicDevLink);
  const clearMagic = useGame((s) => s.clearMagic);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [googleEnabled, setGoogleEnabled] = useState(false);
  const [watching, setWatching] = useState(false);
  const [ofAge, setOfAge] = useState(false);
  const [error, setError] = useState<string | null>(() => readAuthError());

  useEffect(() => {
    void client
      .authConfig()
      .then((c) => setGoogleEnabled(c.google))
      .catch(() => setGoogleEnabled(false));
  }, [client]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signInWithEmail(email);
    } catch {
      setError('Could not sign in — check the email and try again.');
    } finally {
      setBusy(false);
    }
  };

  // After a link is requested, show a "check your inbox" panel instead of the form — no
  // session exists yet; the user signs in by following the email.
  if (magicSent) {
    return (
      <main className="boot">
        <div className="boot-orb" aria-hidden="true" />
        <h1>Check your inbox</h1>
        <p>
          We sent a sign-in link to <strong>{magicSent}</strong>. Tap it to open your glass. The
          link expires in 15 minutes.
        </p>
        {magicDevLink ? (
          <p className="login-devlink">
            Dev mode (no mail provider configured):{' '}
            <a href={magicDevLink}>follow your sign-in link</a>
          </p>
        ) : null}
        <button className="linkish login-watch" onClick={clearMagic}>
          ← Use a different email
        </button>
      </main>
    );
  }

  return (
    <main className="boot">
      <div className="boot-orb" aria-hidden="true" />
      <h1>Amabo</h1>
      <p>A small light lives in a sealed glass world. Be its Light.</p>

      <form className="login-form" onSubmit={submit}>
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          placeholder="you@example.com"
          onChange={(e) => setEmail(e.target.value)}
          aria-label="Email address"
        />
        <label className="login-age">
          <input
            type="checkbox"
            checked={ofAge}
            onChange={(e) => setOfAge(e.target.checked)}
            aria-label="I confirm I am 13 or older"
          />
          <span>
            I’m 13 or older, and I accept the <a href="/terms">Terms</a> and{' '}
            <a href="/privacy">Privacy Policy</a>.
          </span>
        </label>
        <button className="btn btn-login" type="submit" disabled={busy || !ofAge}>
          {busy ? 'Sending the link…' : 'Email me a sign-in link'}
        </button>
      </form>
      {error ? (
        <p className="login-error" role="alert">
          {error}
        </p>
      ) : null}

      {googleEnabled ? (
        <>
          <div className="login-or" aria-hidden="true">
            or
          </div>
          {ofAge ? (
            <a className="btn btn-ghost" href={LOGIN_URL}>
              Continue with Google
            </a>
          ) : (
            <button className="btn btn-ghost" disabled title="Confirm you’re 13+ first">
              Continue with Google
            </button>
          )}
        </>
      ) : null}

      <button className="linkish login-watch" onClick={() => setWatching(true)}>
        ▶ Watch how it works (38s)
      </button>

      {watching ? (
        <div className="video-modal" role="dialog" aria-label="How Amabo works">
          <button
            className="video-close"
            onClick={() => setWatching(false)}
            aria-label="Close the video"
          >
            ✕
          </button>
          <video className="video-player" controls autoPlay poster="/og.png">
            <source src="/amabo-explainer.webm" type="video/webm" />
          </video>
        </div>
      ) : null}
    </main>
  );
}

/**
 * Login.tsx — the threshold. Passwordless email sign-in is the primary path (one field,
 * works everywhere); Google is offered alongside for those who prefer it. On success we
 * hand control back to <App> so it can load the roster.
 */

import { useState } from 'react';
import { LOGIN_URL } from '../api/client.js';
import { useGame } from '../store/useGame.js';

export function Login({ onSignedIn }: { onSignedIn: () => void }) {
  const client = useGame((s) => s.client);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await client.loginWithEmail(email.trim());
      onSignedIn();
    } catch {
      setError('Could not sign in — check the email and try again.');
    } finally {
      setBusy(false);
    }
  };

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
        <button className="btn btn-login" type="submit" disabled={busy}>
          {busy ? 'Opening the glass…' : 'Continue with email'}
        </button>
      </form>
      {error ? (
        <p className="login-error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="login-or" aria-hidden="true">
        or
      </div>
      <a className="btn btn-ghost" href={LOGIN_URL}>
        Continue with Google
      </a>
    </main>
  );
}

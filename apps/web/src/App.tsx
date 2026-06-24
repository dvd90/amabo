/**
 * App.tsx — boots the device. Checks the session; if signed out, offers the OAuth
 * login (the magic beat — opening the device after hours away — lives in `peek`). On
 * load it finds the user's most recent creature, or invites condensing a first Mote.
 */

import { useEffect, useState } from 'react';
import { Device } from './components/Device.js';
import { LOGIN_URL } from './api/client.js';
import { useGame } from './store/useGame.js';

export function App() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const client = useGame((s) => s.client);

  useEffect(() => {
    void client.me().then((me) => setAuthed(Boolean(me)));
  }, [client]);

  if (authed === null) return <main className="boot">Warming the glass…</main>;

  if (!authed) {
    return (
      <main className="boot">
        <h1>Amabo</h1>
        <p>A small light lives in a sealed glass world. Be its Light.</p>
        <a className="btn btn-login" href={LOGIN_URL}>
          Sign in to open the Amarium
        </a>
      </main>
    );
  }

  return (
    <main className="app">
      <Device />
    </main>
  );
}

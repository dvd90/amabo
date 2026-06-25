/**
 * App.tsx — boots the device. Checks the session; if signed out, offers the OAuth
 * login. Once in, it reloads the player's creature (persisted id). With no creature yet
 * it runs the onboarding (the myth + naming your first Mote); otherwise the device.
 */

import { useEffect, useState } from 'react';
import { Device } from './components/Device.js';
import { Onboarding } from './components/Onboarding.js';
import { LOGIN_URL } from './api/client.js';
import { useGame } from './store/useGame.js';

export function App() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const client = useGame((s) => s.client);
  const boot = useGame((s) => s.boot);
  const creature = useGame((s) => s.creature);

  useEffect(() => {
    void client.me().then(async (me) => {
      if (me) await boot();
      setAuthed(Boolean(me));
    });
  }, [client, boot]);

  if (authed === null) return <main className="boot">Warming the glass…</main>;

  if (!authed) {
    return (
      <main className="boot">
        <div className="boot-orb" aria-hidden="true" />
        <h1>Amabo</h1>
        <p>A small light lives in a sealed glass world. Be its Light.</p>
        <a className="btn btn-login" href={LOGIN_URL}>
          Sign in to open the Amarium
        </a>
      </main>
    );
  }

  return <main className="app">{creature ? <Device /> : <Onboarding />}</main>;
}

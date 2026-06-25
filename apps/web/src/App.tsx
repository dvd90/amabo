/**
 * App.tsx — boots the device. Checks the session; if signed out, shows <Login>. Once in,
 * it loads the Light's roster and lands on the <Dashboard>. Opening a creature switches
 * to the <Device>; an empty roster drops straight into <Onboarding> (the myth + first
 * Mote). The active view is driven by the store's `route`.
 */

import { useCallback, useEffect, useState } from 'react';
import { Dashboard } from './components/Dashboard.js';
import { Device } from './components/Device.js';
import { Login } from './components/Login.js';
import { Onboarding } from './components/Onboarding.js';
import { useGame } from './store/useGame.js';

export function App() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const client = useGame((s) => s.client);
  const loadDashboard = useGame((s) => s.loadDashboard);
  const creature = useGame((s) => s.creature);
  const creatures = useGame((s) => s.creatures);
  const route = useGame((s) => s.route);

  const signIn = useCallback(async () => {
    await loadDashboard();
    setAuthed(true);
  }, [loadDashboard]);

  useEffect(() => {
    void client.me().then(async (me) => {
      if (me) await loadDashboard();
      setAuthed(Boolean(me));
    });
  }, [client, loadDashboard]);

  if (authed === null) return <main className="boot">Warming the glass…</main>;

  if (!authed) return <Login onSignedIn={() => void signIn()} />;

  // Inside the device for the open creature; otherwise the roster (or the first-run myth).
  if (route === 'device' && creature) return <main className="app">{<Device />}</main>;
  if (creatures.length === 0) return <main className="app">{<Onboarding />}</main>;
  return <main className="app">{<Dashboard />}</main>;
}

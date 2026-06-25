/**
 * App.tsx — boots the device. Auth state lives in the store (so signing out routes back
 * here, not into an empty dashboard). While the session check is in flight we warm the
 * glass; signed out → <Login>; signed in → the <Dashboard> roster, or <Device> once a
 * creature is open, or <Onboarding> when the roster is empty. The view follows `route`.
 */

import { useEffect } from 'react';
import { Dashboard } from './components/Dashboard.js';
import { Device } from './components/Device.js';
import { Login } from './components/Login.js';
import { Onboarding } from './components/Onboarding.js';
import { useGame } from './store/useGame.js';

export function App() {
  const authed = useGame((s) => s.authed);
  const checkSession = useGame((s) => s.checkSession);
  const creature = useGame((s) => s.creature);
  const creatures = useGame((s) => s.creatures);
  const route = useGame((s) => s.route);

  useEffect(() => {
    void checkSession();
  }, [checkSession]);

  if (authed === null) return <main className="boot">Warming the glass…</main>;
  if (!authed) return <Login />;

  // Inside the device for the open creature; otherwise the roster (or the first-run myth).
  if (route === 'device' && creature) return <main className="app">{<Device />}</main>;
  if (creatures.length === 0) return <main className="app">{<Onboarding />}</main>;
  return <main className="app">{<Dashboard />}</main>;
}

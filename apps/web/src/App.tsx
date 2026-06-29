/**
 * App.tsx — boots the device. Auth state lives in the store (so signing out routes back
 * here, not into an empty dashboard). While the session check is in flight we warm the
 * glass; signed out → <Login>; signed in → the <Dashboard> roster, or <Device> once a
 * creature is open, or <Onboarding> when the roster is empty. The view follows `route`.
 */

import { useEffect } from 'react';
import { Dashboard } from './components/Dashboard.js';
import { Device } from './components/Device.js';
import { Glade } from './components/Glade.js';
import { Login } from './components/Login.js';
import { Onboarding } from './components/Onboarding.js';
import { Welcome } from './components/Welcome.js';
import { PublicLook } from './components/PublicLook.js';
import { useGame } from './store/useGame.js';

/** A public share link (/look/:token) opens the read-only keepsake, no account needed. */
function getLookToken(): string | null {
  if (typeof window === 'undefined') return null;
  const m = window.location.pathname.match(/^\/look\/([^/?]+)/);
  return m ? m[1]! : null;
}

export function App() {
  const lookToken = getLookToken();
  const authed = useGame((s) => s.authed);
  const checkSession = useGame((s) => s.checkSession);
  const creature = useGame((s) => s.creature);
  const creatures = useGame((s) => s.creatures);
  const route = useGame((s) => s.route);
  const authView = useGame((s) => s.authView);
  const theme = useGame((s) => s.theme);

  useEffect(() => {
    if (!lookToken) void checkSession();
  }, [checkSession, lookToken]);

  // Apply the chosen colour theme app-wide (retints --amber / --bg via [data-theme]).
  useEffect(() => {
    if (typeof document !== 'undefined') document.documentElement.dataset.theme = theme;
  }, [theme]);

  if (lookToken) return <PublicLook token={lookToken} />;
  if (authed === null) return <main className="boot">Warming the glass…</main>;
  // Logged out: meet a newborn Mote first (the hook), then the sign-in form.
  if (!authed) return authView === 'login' ? <Login /> : <Welcome />;

  // Inside the device for the open creature; the Glade for the Symposium; otherwise the
  // roster (or the first-run myth).
  if (route === 'device' && creature) return <main className="app">{<Device />}</main>;
  if (route === 'glade') return <main className="app">{<Glade />}</main>;
  if (creatures.length === 0) return <main className="app">{<Onboarding />}</main>;
  return <main className="app">{<Dashboard />}</main>;
}

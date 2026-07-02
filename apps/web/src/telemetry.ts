/**
 * telemetry.ts — the funnel's voice (LAUNCH_PLAN.md L1). Tiny, fire-and-forget beats
 * to our own API (`POST /telemetry`) — no third party, no cookies. Every call is
 * best-effort: telemetry must never break the game, so all failures are swallowed.
 * Server-side beats (signup, creature_created, care_action, peek) are logged by the
 * API itself; the client only reports what the server can't see.
 */

import { API_BASE } from './api/client.js';

const ANON_KEY = 'amabo:anon';

/** A stable, anonymous per-device id (random UUID, localStorage). */
export function anonId(): string {
  try {
    let v = localStorage.getItem(ANON_KEY);
    if (!v) {
      v = crypto.randomUUID();
      localStorage.setItem(ANON_KEY, v);
    }
    return v;
  } catch {
    return 'anon';
  }
}

export function track(name: string, props?: Record<string, unknown>): void {
  try {
    void fetch(`${API_BASE}/telemetry`, {
      method: 'POST',
      keepalive: true,
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ anonId: anonId(), events: [{ name, props }] }),
    }).catch(() => {});
  } catch {
    /* never the game's problem */
  }
}

/** Cap error beats so a render loop can't flood the funnel (or the monitor). */
const MAX_ERRORS_PER_SESSION = 5;
let reported = 0;

/** Forward uncaught client errors as `client_error` beats (the API relays to Sentry). */
export function initClientMonitoring(): void {
  window.addEventListener('error', (e) => {
    if (reported++ < MAX_ERRORS_PER_SESSION) {
      track('client_error', { message: String(e.message ?? 'error').slice(0, 300) });
    }
  });
  window.addEventListener('unhandledrejection', (e) => {
    if (reported++ < MAX_ERRORS_PER_SESSION) {
      const msg = e.reason instanceof Error ? e.reason.message : String(e.reason);
      track('client_error', { message: msg.slice(0, 300), unhandled: true });
    }
  });
}

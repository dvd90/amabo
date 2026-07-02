/**
 * monitor.ts — error eyes (LAUNCH_PLAN.md L1). A dependency-free Sentry client: we
 * speak the envelope protocol directly (one HTTP POST) instead of carrying the SDK,
 * in the same spirit as cors.ts and rateLimit.ts. A missing/malformed DSN degrades
 * to a no-op, and capture() NEVER throws — the monitor must not be a new crash.
 */

import { randomUUID } from 'node:crypto';

export interface Monitor {
  capture(err: unknown, context?: Record<string, unknown>): void;
}

export const nullMonitor: Monitor = { capture: () => {} };

/** DSN `https://<key>@<host>/<projectId>` → envelope endpoint + auth key. */
function parseDsn(dsn: string): { endpoint: string; key: string } | null {
  try {
    const u = new URL(dsn);
    const key = u.username;
    const projectId = u.pathname.replace(/^\//, '');
    if (!key || !projectId) return null;
    return { endpoint: `${u.protocol}//${u.host}/api/${projectId}/envelope/`, key };
  } catch {
    return null;
  }
}

export function sentryMonitor(
  dsn: string,
  release = 'dev',
  fetchFn: typeof fetch = fetch,
): Monitor {
  const parsed = parseDsn(dsn);
  if (!parsed) return nullMonitor;
  const { endpoint, key } = parsed;

  return {
    capture(err, context) {
      try {
        const e = err instanceof Error ? err : new Error(String(err));
        const eventId = randomUUID().replaceAll('-', '');
        const sentAt = new Date().toISOString();
        const event = {
          event_id: eventId,
          timestamp: sentAt,
          platform: 'node',
          level: 'error',
          release,
          message: e.message,
          extra: { stack: e.stack, ...context },
        };
        const body = [
          JSON.stringify({ event_id: eventId, sent_at: sentAt }),
          JSON.stringify({ type: 'event' }),
          JSON.stringify(event),
        ].join('\n');
        void fetchFn(endpoint, {
          method: 'POST',
          headers: {
            'content-type': 'application/x-sentry-envelope',
            'x-sentry-auth': `Sentry sentry_version=7, sentry_client=amabo/1, sentry_key=${key}`,
          },
          body,
        }).catch(() => {});
      } catch {
        /* the monitor never becomes the outage */
      }
    },
  };
}

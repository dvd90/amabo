import { describe, expect, it, vi } from 'vitest';
import { nullMonitor, sentryMonitor } from './monitor.js';

const DSN = 'https://abc123@o99.ingest.sentry.io/424242';

describe('the monitor (L1) — Sentry-compatible, dependency-free', () => {
  it('posts an envelope to the DSN project with the auth key', async () => {
    const fetchFn = vi.fn().mockResolvedValue({ ok: true });
    const m = sentryMonitor(DSN, 'sha1234', fetchFn as unknown as typeof fetch);
    m.capture(new Error('the glass cracked'), { route: '/creatures' });
    await Promise.resolve();

    expect(fetchFn).toHaveBeenCalledTimes(1);
    const [url, init] = fetchFn.mock.calls[0]!;
    expect(url).toBe('https://o99.ingest.sentry.io/api/424242/envelope/');
    expect(init.headers['x-sentry-auth']).toContain('sentry_key=abc123');
    expect(init.body).toContain('the glass cracked');
    expect(init.body).toContain('sha1234'); // the release ties errors to a deploy
  });

  it('never throws: a failing transport is swallowed, a malformed DSN is a no-op', () => {
    const failing = vi.fn().mockRejectedValue(new Error('offline'));
    const m = sentryMonitor(DSN, 'dev', failing as unknown as typeof fetch);
    expect(() => m.capture(new Error('x'))).not.toThrow();

    const bad = sentryMonitor('not a dsn', 'dev', failing as unknown as typeof fetch);
    expect(() => bad.capture(new Error('x'))).not.toThrow();
    expect(failing).toHaveBeenCalledTimes(1); // only the valid DSN ever sent

    expect(() => nullMonitor.capture(new Error('x'))).not.toThrow();
  });
});

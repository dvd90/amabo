// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { anonId, initClientMonitoring, track } from './telemetry.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('telemetry (L1) — fire-and-forget beats', () => {
  it('posts a named beat with a stable anonymous id', () => {
    const fetchFn = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchFn);
    track('visit');
    track('birth_seen', { seed: 7 });

    expect(fetchFn).toHaveBeenCalledTimes(2);
    const first = JSON.parse(fetchFn.mock.calls[0]![1].body as string);
    const second = JSON.parse(fetchFn.mock.calls[1]![1].body as string);
    expect(first.events[0].name).toBe('visit');
    expect(second.events[0].props).toEqual({ seed: 7 });
    expect(first.anonId).toBe(second.anonId); // stable across beats
    expect(first.anonId).toBe(anonId());
  });

  it('never throws when the network is gone', () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => {
        throw new Error('offline');
      }),
    );
    expect(() => track('visit')).not.toThrow();
  });

  it('reports uncaught errors as client_error beats, capped per session', () => {
    const fetchFn = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchFn);
    initClientMonitoring();
    window.dispatchEvent(new ErrorEvent('error', { message: 'the glass cracked' }));

    expect(fetchFn).toHaveBeenCalled();
    const body = JSON.parse(fetchFn.mock.calls.at(-1)![1].body as string);
    expect(body.events[0].name).toBe('client_error');
    expect(body.events[0].props.message).toContain('the glass cracked');
  });
});

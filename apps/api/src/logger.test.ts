import { describe, expect, it } from 'vitest';
import { envLogger, Logger, noopLogger } from './logger.js';

/** Collects emitted lines so tests can read them back. */
function capture() {
  const lines: { line: string; level: string }[] = [];
  return {
    lines,
    write: (line: string, level: string) => {
      lines.push({ line, level });
    },
  };
}

const T0 = Date.parse('2026-07-04T10:00:00.000Z');

describe('the Logger — one clear voice for every failure in the backend', () => {
  it('prints a readable line: timestamp, level, scope, message, fields', () => {
    const out = capture();
    const log = new Logger({ level: 'debug', write: out.write, now: () => T0 });
    log.child('narration').warn('model call failed', { provider: 'grok', status: 503 });

    expect(out.lines).toHaveLength(1);
    const { line, level } = out.lines[0]!;
    expect(level).toBe('warn');
    expect(line).toContain('2026-07-04T10:00:00.000Z');
    expect(line).toContain('WARN');
    expect(line).toContain('[narration]');
    expect(line).toContain('model call failed');
    expect(line).toContain('provider=grok');
    expect(line).toContain('status=503');
  });

  it('filters below the configured level, and "silent" drops everything', () => {
    const out = capture();
    const log = new Logger({ level: 'warn', write: out.write, now: () => T0 });
    log.debug('too quiet');
    log.info('still too quiet');
    log.warn('heard');
    log.error('heard');
    expect(out.lines.map((l) => l.level)).toEqual(['warn', 'error']);

    const muted = capture();
    new Logger({ level: 'silent', write: muted.write }).error('nothing');
    expect(muted.lines).toHaveLength(0);
  });

  it('quotes strings with spaces and JSON-serializes objects', () => {
    const out = capture();
    const log = new Logger({ level: 'info', write: out.write, now: () => T0 });
    log.info('boot', { note: 'two words', cfg: { a: 1 } });
    const { line } = out.lines[0]!;
    expect(line).toContain('note="two words"');
    expect(line).toContain('cfg={"a":1}');
  });

  it('an Error field shows its message, and its stack on error level', () => {
    const out = capture();
    const log = new Logger({ level: 'info', write: out.write, now: () => T0 });
    const boom = new Error('the till jammed');

    log.warn('almost', { err: boom });
    expect(out.lines[0]!.line).toContain('err="the till jammed"');
    expect(out.lines[0]!.line).not.toContain('logger.test.ts:'); // no stack at warn

    log.error('down', { err: boom });
    expect(out.lines[1]!.line).toContain('err="the till jammed"');
    expect(out.lines[1]!.line).toContain('Error: the till jammed'); // stack attached
  });

  it('children join scopes and inherit bound fields', () => {
    const out = capture();
    const root = new Logger({ level: 'info', write: out.write, now: () => T0 });
    const meter = root.child('narration', { provider: 'grok' }).child('meter');
    meter.info('breaker tripped', { cap: 2000 });
    const { line } = out.lines[0]!;
    expect(line).toContain('[narration:meter]');
    expect(line).toContain('provider=grok');
    expect(line).toContain('cap=2000');
  });

  it('speaks JSON when asked (one parseable object per line)', () => {
    const out = capture();
    const log = new Logger({ level: 'info', format: 'json', write: out.write, now: () => T0 });
    log.child('auth').error('oauth callback failed', { err: new Error('bad code') });
    const parsed = JSON.parse(out.lines[0]!.line) as Record<string, unknown>;
    expect(parsed.ts).toBe('2026-07-04T10:00:00.000Z');
    expect(parsed.level).toBe('error');
    expect(parsed.scope).toBe('auth');
    expect(parsed.msg).toBe('oauth callback failed');
    expect((parsed.err as { message: string }).message).toBe('bad code');
    expect((parsed.err as { stack?: string }).stack).toBeTruthy();
  });

  it('never throws — circular fields degrade, they do not crash the app', () => {
    const out = capture();
    const log = new Logger({ level: 'info', write: out.write, now: () => T0 });
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(() => log.info('odd payload', { circular })).not.toThrow();
    expect(out.lines).toHaveLength(1);
    expect(out.lines[0]!.line).toContain('circular=');
  });

  it('envLogger reads LOG_LEVEL, and defaults to silent under test', () => {
    expect(envLogger({ LOG_LEVEL: 'debug' }).level).toBe('debug');
    expect(envLogger({ NODE_ENV: 'test' }).level).toBe('silent');
    expect(envLogger({ NODE_ENV: 'production' }).level).toBe('info');
    expect(envLogger({ LOG_LEVEL: 'nonsense', NODE_ENV: 'production' }).level).toBe('info');
    expect(noopLogger.level).toBe('silent');
  });
});

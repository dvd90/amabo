/**
 * logger.ts — one clear voice for everything the backend has to say (especially when
 * it fails). Dependency-free, in the same spirit as monitor.ts and cors.ts.
 *
 * Shape of a line (pretty, the default):
 *
 *   2026-07-04T10:00:00.000Z WARN  [narration:meter] breaker tripped cap=2000
 *
 * Rules:
 *  - levels debug < info < warn < error, plus `silent` (tests default to silent);
 *  - `child(scope, fields)` binds a scope and fields onto every line it emits, so a
 *    subsystem logs once-wired context (provider, route) for free;
 *  - an Error field prints its message; at error level its stack follows;
 *  - `LOG_FORMAT=json` emits one JSON object per line for machine-read pipelines;
 *  - logging NEVER throws — a circular payload degrades, it does not become the outage.
 *
 * The logger reports; the monitor (monitor.ts) alerts. Failure points log here AND
 * capture() where a human should be paged — the two are deliberately not merged.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';
type EmitLevel = Exclude<LogLevel, 'silent'>;

export type LogFields = Record<string, unknown>;

const WEIGHT: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40, silent: 99 };

export interface LoggerOptions {
  /** Lowest level that gets written. Default `info`. */
  level?: LogLevel;
  /** `pretty` (human, the default) or `json` (one object per line). */
  format?: 'pretty' | 'json';
  /** The sink — injected in tests; defaults to the console (warn/error → stderr). */
  write?: (line: string, level: EmitLevel) => void;
  /** Injected time source, for deterministic tests. */
  now?: () => number;
}

const consoleWrite = (line: string, level: EmitLevel): void => {
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
};

/** A bare word prints as-is; anything else is JSON-quoted so the line stays parseable. */
const BARE = /^[\w.:/@-]+$/;

function renderValue(v: unknown): string {
  try {
    if (v instanceof Error) return JSON.stringify(v.message);
    if (typeof v === 'string') return BARE.test(v) ? v : JSON.stringify(v);
    if (typeof v === 'number' || typeof v === 'boolean' || v == null) return String(v);
    return JSON.stringify(v) ?? String(v);
  } catch {
    return '"[unserializable]"';
  }
}

function jsonValue(v: unknown): unknown {
  if (v instanceof Error) return { message: v.message, stack: v.stack };
  try {
    JSON.stringify(v); // probe for circularity
    return v;
  } catch {
    return '[unserializable]';
  }
}

export class Logger {
  readonly level: LogLevel;
  private readonly format: 'pretty' | 'json';
  private readonly write: (line: string, level: EmitLevel) => void;
  private readonly now: () => number;
  private readonly scope: string;
  private readonly bound: LogFields;

  constructor(opts: LoggerOptions = {}, scope = '', bound: LogFields = {}) {
    this.level = opts.level ?? 'info';
    this.format = opts.format ?? 'pretty';
    this.write = opts.write ?? consoleWrite;
    this.now = opts.now ?? Date.now;
    this.scope = scope;
    this.bound = bound;
  }

  /** A logger for a subsystem: scopes join with `:`, fields ride on every line. */
  child(scope: string, fields?: LogFields): Logger {
    return new Logger(
      { level: this.level, format: this.format, write: this.write, now: this.now },
      this.scope ? `${this.scope}:${scope}` : scope,
      { ...this.bound, ...fields },
    );
  }

  debug(msg: string, fields?: LogFields): void {
    this.emit('debug', msg, fields);
  }
  info(msg: string, fields?: LogFields): void {
    this.emit('info', msg, fields);
  }
  warn(msg: string, fields?: LogFields): void {
    this.emit('warn', msg, fields);
  }
  error(msg: string, fields?: LogFields): void {
    this.emit('error', msg, fields);
  }

  private emit(level: EmitLevel, msg: string, fields?: LogFields): void {
    try {
      if (WEIGHT[level] < WEIGHT[this.level]) return;
      const all = { ...this.bound, ...fields };
      const ts = new Date(this.now()).toISOString();

      if (this.format === 'json') {
        const entry: Record<string, unknown> = { ts, level, msg };
        if (this.scope) entry.scope = this.scope;
        for (const [k, v] of Object.entries(all)) entry[k] = jsonValue(v);
        this.write(JSON.stringify(entry), level);
        return;
      }

      const parts = [ts, level.toUpperCase().padEnd(5)];
      if (this.scope) parts.push(`[${this.scope}]`);
      parts.push(msg);
      for (const [k, v] of Object.entries(all)) parts.push(`${k}=${renderValue(v)}`);
      let line = parts.join(' ');
      // At error level the stack matters — attach it under the line, indented.
      if (level === 'error') {
        for (const v of Object.values(all)) {
          if (v instanceof Error && v.stack) line += `\n    ${v.stack.replaceAll('\n', '\n    ')}`;
        }
      }
      this.write(line, level);
    } catch {
      /* logging must never become the outage */
    }
  }
}

/** The do-nothing logger — the default where tests don't care about output. */
export const noopLogger = new Logger({ level: 'silent' });

const LEVELS = new Set<LogLevel>(['debug', 'info', 'warn', 'error', 'silent']);

/**
 * The process logger, configured from the environment: LOG_LEVEL (debug|info|warn|
 * error|silent; default info — silent under NODE_ENV=test so suites stay readable)
 * and LOG_FORMAT=json for structured pipelines.
 */
export function envLogger(env: Record<string, string | undefined> = process.env): Logger {
  const asked = env.LOG_LEVEL as LogLevel | undefined;
  const level = asked && LEVELS.has(asked) ? asked : env.NODE_ENV === 'test' ? 'silent' : 'info';
  return new Logger({ level, format: env.LOG_FORMAT === 'json' ? 'json' : 'pretty' });
}

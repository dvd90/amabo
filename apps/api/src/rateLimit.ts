/**
 * rateLimit.ts — a minimal in-process sliding-window rate limiter. No dependency, in
 * the same spirit as cors.ts. Guards the real abuse/cost surfaces: magic-link mail
 * spam, the public demo endpoint, creature/account flooding, and — once AI narration
 * is turned on — unbounded model spend via peek/gather.
 *
 * In-process means counts reset on redeploy and aren't shared across instances; that's
 * the right tradeoff for a single small API service (ARCHITECTURE.md's "lazy, no
 * always-on worker" model) — a real distributed limiter (Redis) is a v2 concern once
 * there's more than one instance to coordinate.
 */

import type { NextFunction, Request, Response } from 'express';
import type { Clock } from './clock.js';
import { systemClock } from './clock.js';

export interface RateLimitOptions {
  /** The sliding window, in ms. */
  windowMs: number;
  /** Max requests from one key inside the window. */
  max: number;
  /** How to bucket a request — e.g. the caller's IP, or the signed-in user's id. */
  keyOf: (req: Request) => string;
  /** Shown in the 429 body. */
  message?: string;
  clock?: Clock;
}

/** Past this many tracked keys, opportunistically drop ones with no recent hits. */
const SWEEP_AT = 5000;

export function rateLimit(opts: RateLimitOptions) {
  const clock = opts.clock ?? systemClock;
  const hits = new Map<string, number[]>();

  return (req: Request, res: Response, next: NextFunction): void => {
    const key = opts.keyOf(req);
    const now = clock();
    const cutoff = now - opts.windowMs;
    const recent = (hits.get(key) ?? []).filter((t) => t > cutoff);

    if (recent.length >= opts.max) {
      hits.set(key, recent);
      res
        .status(429)
        .json({ error: opts.message ?? 'too many requests — slow down and try again shortly' });
      return;
    }

    recent.push(now);
    hits.set(key, recent);

    if (hits.size > SWEEP_AT) {
      for (const [k, arr] of hits) {
        const live = arr.filter((t) => t > cutoff);
        if (live.length === 0) hits.delete(k);
        else hits.set(k, live);
      }
    }
    next();
  };
}

/** The caller's IP — the right key for routes hit before anyone is signed in. */
export function byIp(req: Request): string {
  return req.ip ?? 'unknown';
}

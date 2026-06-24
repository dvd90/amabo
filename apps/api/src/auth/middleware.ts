/**
 * auth/middleware.ts — session attachment, the auth gate, and CSRF protection.
 * Owner-scoping everywhere downstream depends on `req.user` being set here.
 */

import type { NextFunction, Request, Response } from 'express';
import type { Clock } from '../clock.js';
import type { Repository, UserRecord } from '../repo/types.js';
import { CSRF_COOKIE, SESSION_COOKIE, parseCookies } from './session.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: UserRecord;
      csrfToken?: string;
    }
  }
}

/** Load the session (if any) and attach the user. Expired sessions are ignored. */
export function attachUser(repo: Repository, clock: Clock) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const sid = parseCookies(req)[SESSION_COOKIE];
      if (sid) {
        const found = await repo.getSession(sid);
        if (found && found.session.expiresAt > clock()) {
          req.user = found.user;
          req.csrfToken = found.session.csrfToken;
        }
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

/** Reject unauthenticated requests (401). */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: 'authentication required' });
    return;
  }
  next();
}

/**
 * Double-submit CSRF on state-changing methods: the X-CSRF-Token header must match
 * the session's token (also mirrored in a readable cookie). Safe methods pass through.
 */
export function requireCsrf(req: Request, res: Response, next: NextFunction): void {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    next();
    return;
  }
  const header = req.header('x-csrf-token');
  const cookie = parseCookies(req)[CSRF_COOKIE];
  if (!req.csrfToken || header !== req.csrfToken || cookie !== req.csrfToken) {
    res.status(403).json({ error: 'invalid CSRF token' });
    return;
  }
  next();
}

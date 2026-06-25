/**
 * auth/middleware.ts — session attachment, the auth gate, and CSRF protection.
 * Owner-scoping everywhere downstream depends on `req.user` being set here.
 */

import type { NextFunction, Request, Response } from 'express';
import type { Clock } from '../clock.js';
import type { Repository, UserRecord } from '../repo/types.js';
import { SESSION_COOKIE, parseCookies } from './session.js';

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
 * CSRF on state-changing methods (synchronizer-token pattern): the X-CSRF-Token header
 * must equal the token bound to the server-side session (delivered to the client via
 * GET /me, and also mirrored in a readable cookie for the single-origin case). We compare
 * against the *session* token — not a blind double-submit — so it works cross-origin too:
 * a hostile site can't read /me (CORS blocks the response), so it can't learn the token.
 * Safe methods pass through.
 */
export function requireCsrf(req: Request, res: Response, next: NextFunction): void {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    next();
    return;
  }
  const header = req.header('x-csrf-token');
  if (!req.csrfToken || header !== req.csrfToken) {
    res.status(403).json({ error: 'invalid CSRF token' });
    return;
  }
  next();
}

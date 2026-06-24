/**
 * routes/auth.ts — OAuth + session lifecycle (ARCHITECTURE.md §14). A new session is
 * minted on every successful login (no session fixation), delivered as httpOnly
 * cookies, and torn down on logout. `/me` returns the current user + CSRF token.
 */

import { Router, type Request, type Response } from 'express';
import type { Clock } from '../clock.js';
import type { AuthProvider } from '../auth/provider.js';
import {
  SESSION_TTL_MS,
  clearSessionCookies,
  newToken,
  parseCookies,
  setSessionCookies,
} from '../auth/session.js';
import { requireAuth, requireCsrf } from '../auth/middleware.js';
import type { Repository } from '../repo/types.js';

export interface AuthDeps {
  repo: Repository;
  authProvider: AuthProvider;
  clock: Clock;
  cookieSecure: boolean;
  baseUrl: string; // used to build the OAuth redirect URI
}

const STATE_COOKIE = 'amabo_oauth_state';

export function authRouter(deps: AuthDeps): Router {
  const { repo, authProvider, clock, cookieSecure, baseUrl } = deps;
  const router = Router();
  const redirectUri = `${baseUrl}/auth/callback`;

  // Begin sign-in: set a state cookie and redirect to the provider.
  router.get('/auth/google', (_req: Request, res: Response) => {
    const state = newToken();
    res.cookie(STATE_COOKIE, state, {
      httpOnly: true,
      sameSite: 'lax',
      secure: cookieSecure,
      path: '/',
      maxAge: 10 * 60 * 1000,
    });
    res.redirect(authProvider.authUrl(state, redirectUri));
  });

  // OAuth callback: verify state, exchange code, upsert user, mint a fresh session.
  router.get('/auth/callback', (req: Request, res: Response, next) => {
    void (async () => {
      try {
        const code = String(req.query.code ?? '');
        const state = String(req.query.state ?? '');
        const expected = parseCookies(req)[STATE_COOKIE];
        if (!code || !state || !expected || state !== expected) {
          res.status(400).json({ error: 'invalid oauth state' });
          return;
        }
        const profile = await authProvider.exchange(code, redirectUri);
        const user = await repo.upsertUser({
          provider: profile.provider,
          subject: profile.subject,
          email: profile.email,
          displayName: profile.displayName,
        });
        const csrf = newToken();
        const session = await repo.createSession(user.id, csrf, clock() + SESSION_TTL_MS);
        res.clearCookie(STATE_COOKIE, { path: '/' });
        setSessionCookies(res, session.id, csrf, cookieSecure);
        res.redirect('/');
      } catch (err) {
        next(err);
      }
    })();
  });

  // Current user (and the CSRF token to use for mutations).
  router.get('/me', requireAuth, (req: Request, res: Response) => {
    res.json({
      user: {
        id: req.user!.id,
        email: req.user!.email,
        displayName: req.user!.displayName,
        ageBand: req.user!.ageBand,
      },
      csrfToken: req.csrfToken,
    });
  });

  // Logout: destroy the session (CSRF-protected).
  router.post('/auth/logout', requireAuth, requireCsrf, (req: Request, res: Response, next) => {
    void (async () => {
      try {
        const sid = parseCookies(req)['amabo_session'];
        if (sid) await repo.deleteSession(sid);
        clearSessionCookies(res);
        res.json({ ok: true });
      } catch (err) {
        next(err);
      }
    })();
  });

  return router;
}

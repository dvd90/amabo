/**
 * routes/auth.ts — OAuth + session lifecycle (ARCHITECTURE.md §14). A new session is
 * minted on every successful login (no session fixation), delivered as httpOnly
 * cookies, and torn down on logout. `/me` returns the current user + CSRF token.
 */

import { EmailLoginRequest } from '@amabo/shared';
import { Router, type Request, type Response } from 'express';
import type { Clock } from '../clock.js';
import type { AuthProvider } from '../auth/provider.js';
import {
  SESSION_TTL_MS,
  clearSessionCookies,
  newToken,
  parseCookies,
  setSessionCookies,
  type SameSite,
} from '../auth/session.js';
import { requireAuth, requireCsrf } from '../auth/middleware.js';
import type { Repository, UserRecord } from '../repo/types.js';

export interface AuthDeps {
  repo: Repository;
  authProvider: AuthProvider;
  clock: Clock;
  cookieSecure: boolean;
  sameSite: SameSite;
  baseUrl: string; // used to build the OAuth redirect URI (the API's own origin)
  /** Where to send the browser after login (the web origin in a two-service deploy). */
  postLoginRedirect: string;
}

const STATE_COOKIE = 'amabo_oauth_state';

export function authRouter(deps: AuthDeps): Router {
  const { repo, authProvider, clock, cookieSecure, sameSite, baseUrl, postLoginRedirect } = deps;
  const router = Router();

  /**
   * The OAuth redirect URI must EXACTLY match what's registered with the provider AND
   * the host the browser actually hit. Deriving it from the request (honouring the
   * proxy's X-Forwarded-* via `trust proxy`) removes the #1 production failure: a wrong
   * BASE_URL (e.g. the localhost default) causing `redirect_uri_mismatch`.
   */
  const callbackUrl = (req: Request): string => {
    const host = req.get('host');
    const origin = host ? `${req.protocol}://${host}` : baseUrl;
    return `${origin}/auth/callback`;
  };

  /** Mint a fresh session for a verified user and deliver the cookies (no fixation). */
  const establishSession = async (res: Response, user: UserRecord): Promise<string> => {
    const csrf = newToken();
    const session = await repo.createSession(user.id, csrf, clock() + SESSION_TTL_MS);
    setSessionCookies(res, session.id, csrf, cookieSecure, sameSite);
    return csrf;
  };

  // Passwordless email sign-in: the launch path. A direct POST (no third-party redirect)
  // so it works reliably cross-origin. The email is the identity; no password is stored.
  router.post('/auth/email', (req: Request, res: Response, next) => {
    void (async () => {
      try {
        const parsed = EmailLoginRequest.safeParse(req.body);
        if (!parsed.success) {
          res.status(400).json({ error: 'a valid email is required' });
          return;
        }
        const email = parsed.data.email.toLowerCase();
        const user = await repo.upsertUser({
          provider: 'email',
          subject: email,
          email,
          displayName: email.split('@')[0] || email,
        });
        const csrf = await establishSession(res, user);
        res.json({
          user: { id: user.id, email: user.email, displayName: user.displayName },
          csrfToken: csrf,
        });
      } catch (err) {
        next(err);
      }
    })();
  });

  // Begin OAuth sign-in: set a state cookie and redirect to the provider.
  router.get('/auth/google', (req: Request, res: Response) => {
    const state = newToken();
    res.cookie(STATE_COOKIE, state, {
      httpOnly: true,
      sameSite,
      secure: cookieSecure,
      path: '/',
      maxAge: 10 * 60 * 1000,
    });
    res.redirect(authProvider.authUrl(state, callbackUrl(req)));
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
        const profile = await authProvider.exchange(code, callbackUrl(req));
        const user = await repo.upsertUser({
          provider: profile.provider,
          subject: profile.subject,
          email: profile.email,
          displayName: profile.displayName,
        });
        res.clearCookie(STATE_COOKIE, { path: '/' });
        await establishSession(res, user);
        res.redirect(postLoginRedirect);
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

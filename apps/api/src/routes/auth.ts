/**
 * routes/auth.ts — OAuth + session lifecycle (ARCHITECTURE.md §14). A new session is
 * minted on every successful login (no session fixation), delivered as httpOnly
 * cookies, and torn down on logout. `/me` returns the current user + CSRF token.
 */

import { EmailLoginRequest, UserPreferences } from '@amabo/shared';
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
import { makeMagicToken, verifyMagicToken } from '../auth/magic.js';
import type { Mailer } from '../auth/mailer.js';
import type { Repository, UserRecord } from '../repo/types.js';
import { byIp, rateLimit } from '../rateLimit.js';

/** How long a magic-link is valid for. */
const MAGIC_TTL_MS = 15 * 60 * 1000;
// A real mail send per request — generous for a Light retrying a missed email, a wall
// against using this endpoint to mail-bomb arbitrary addresses from our domain.
const MAGIC_REQUEST_MAX = 5;
const MAGIC_REQUEST_WINDOW_MS = 15 * 60 * 1000;

export interface AuthDeps {
  repo: Repository;
  authProvider: AuthProvider;
  clock: Clock;
  cookieSecure: boolean;
  sameSite: SameSite;
  baseUrl: string; // used to build the OAuth redirect URI (the API's own origin)
  /** Where to send the browser after login (the web origin in a two-service deploy). */
  postLoginRedirect: string;
  /** True only when real Google credentials are configured (controls the UI button). */
  googleEnabled: boolean;
  /** Delivers the magic sign-in link by email. */
  mailer: Mailer;
  /** HMAC secret that signs magic-link tokens (AUTH_SECRET). */
  magicSecret: string;
  /**
   * Only in local dev (no real mail provider) do we return the magic link in the POST
   * response so testing works without an inbox. MUST be false in production — echoing the
   * link would re-open the very hole we're closing (anyone could sign in as any address).
   */
  magicDevEcho: boolean;
  /**
   * Exact OAuth redirect URI to use, if you want to pin it (GOOGLE_CALLBACK_URL). Must
   * match what's registered in the provider console. When unset we derive it from the
   * request host. Its path also becomes a callback route, so either `/auth/callback` or
   * `/auth/google/callback` works.
   */
  callbackOverride?: string;
}

const STATE_COOKIE = 'amabo_oauth_state';

export function authRouter(deps: AuthDeps): Router {
  const { repo, authProvider, clock, cookieSecure, sameSite, baseUrl, postLoginRedirect } = deps;
  const router = Router();
  const magicLimiter = rateLimit({
    windowMs: MAGIC_REQUEST_WINDOW_MS,
    max: MAGIC_REQUEST_MAX,
    keyOf: byIp,
    clock,
    message: 'too many sign-in requests — wait a bit and try again',
  });

  // What sign-in methods the client should offer (email is always on).
  router.get('/auth/config', (_req: Request, res: Response) => {
    res.json({ email: true, google: deps.googleEnabled });
  });

  /**
   * The OAuth redirect URI must EXACTLY match what's registered with the provider AND
   * the host the browser actually hit. Deriving it from the request (honouring the
   * proxy's X-Forwarded-* via `trust proxy`) removes the #1 production failure: a wrong
   * BASE_URL (e.g. the localhost default) causing `redirect_uri_mismatch`.
   */
  const callbackUrl = (req: Request): string => {
    if (deps.callbackOverride) return deps.callbackOverride;
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

  // The origin to build the magic link on — the host the browser actually hit (honouring
  // the proxy's X-Forwarded-*), so the link reaches THIS API and its cookies are first-party.
  const requestOrigin = (req: Request): string => {
    const host = req.get('host');
    return host ? `${req.protocol}://${host}` : baseUrl;
  };

  // Passwordless email sign-in (magic link). This does NOT sign anyone in: it mails a
  // short-lived signed link, and only following that link (the GET below) establishes a
  // session — so possession of the address is proven and you can't claim an account that
  // isn't yours. The response is deliberately neutral (never reveals whether the address
  // is known); only in dev (no real mailer) is the link echoed back for testing.
  router.post('/auth/email', magicLimiter, (req: Request, res: Response, next) => {
    void (async () => {
      try {
        const parsed = EmailLoginRequest.safeParse(req.body);
        if (!parsed.success) {
          res.status(400).json({ error: 'a valid email is required' });
          return;
        }
        const email = parsed.data.email.toLowerCase();
        const token = makeMagicToken(email, clock() + MAGIC_TTL_MS, deps.magicSecret);
        const link = `${requestOrigin(req)}/auth/email/callback?token=${encodeURIComponent(token)}`;
        try {
          await deps.mailer.sendMagicLink(email, link);
        } catch (e) {
          // Don't leak delivery state to the caller; log it for ops and still answer 200.
          console.error('[amabo] failed to send magic link:', (e as Error).message);
        }
        res.json({ sent: true, ...(deps.magicDevEcho ? { devLink: link } : {}) });
      } catch (err) {
        next(err);
      }
    })();
  });

  // Begin OAuth sign-in: set a state cookie and redirect to the provider. The state
  // cookie is SameSite=Lax (NOT None): it's only ever read back on this same API origin
  // during the top-level redirect from Google, where Lax cookies ARE sent — and Lax
  // survives Safari/ITP and partitioned-cookie rules that can silently drop None cookies.
  router.get('/auth/google', (req: Request, res: Response) => {
    const state = newToken();
    res.cookie(STATE_COOKIE, state, {
      httpOnly: true,
      sameSite: 'lax',
      secure: cookieSecure,
      path: '/',
      maxAge: 10 * 60 * 1000,
    });
    const redirectUri = callbackUrl(req);
    // The exact value sent to Google — must match an Authorized redirect URI there,
    // or Google answers `redirect_uri_mismatch`. Logged so it can be copied verbatim.
    if (deps.googleEnabled)
      console.info('[amabo] OAuth redirect_uri sent to Google →', redirectUri);
    res.redirect(authProvider.authUrl(state, redirectUri));
  });

  // Where to send the browser back to after the OAuth dance, with an error flagged so
  // the sign-in screen can show it instead of failing into a blank page.
  const backToLogin = (res: Response, reason: string) => {
    const base = postLoginRedirect === '/' ? '' : postLoginRedirect;
    res.redirect(`${base}/?auth_error=${encodeURIComponent(reason)}`);
  };

  // OAuth callback: verify state, exchange code, upsert user, mint a fresh session.
  // Registered at BOTH /auth/callback and /auth/google/callback so whichever path the
  // provider console / GOOGLE_CALLBACK_URL uses lands here.
  const handleCallback = (req: Request, res: Response) => {
    void (async () => {
      try {
        const code = String(req.query.code ?? '');
        const state = String(req.query.state ?? '');
        const expected = parseCookies(req)[STATE_COOKIE];
        if (req.query.error) return backToLogin(res, String(req.query.error));
        if (!code || !state || !expected || state !== expected) {
          return backToLogin(res, 'state');
        }
        const profile = await authProvider.exchange(code, callbackUrl(req));
        const user = await repo.upsertUser({
          provider: profile.provider,
          subject: profile.subject,
          email: profile.email,
          displayName: profile.displayName,
          emailVerified: profile.emailVerified,
          ageBand: profile.ageBand ?? null,
        });
        res.clearCookie(STATE_COOKIE, { path: '/' });
        if (user.created) {
          await repo.addTelemetry([
            { name: 'signup', anonId: null, userId: user.id, at: clock(), props: null },
          ]);
        }
        await establishSession(res, user);
        res.redirect(postLoginRedirect);
      } catch (err) {
        // Surface the real reason in the server log; show a friendly flag to the user.
        console.error('[amabo] google oauth callback failed:', (err as Error).message);
        backToLogin(res, 'google');
      }
    })();
  };
  router.get('/auth/callback', handleCallback);
  router.get('/auth/google/callback', handleCallback);

  // Magic-link callback: verify the signed token, then upsert by email (provider 'email',
  // subject = the address) so an EXISTING email user lands back in their own account with
  // all their amabos. A bad/expired link bounces to login flagged, never a session.
  router.get('/auth/email/callback', (req: Request, res: Response, next) => {
    void (async () => {
      try {
        const email = verifyMagicToken(String(req.query.token ?? ''), clock(), deps.magicSecret);
        if (!email) return backToLogin(res, 'link');
        const user = await repo.upsertUser({
          provider: 'email',
          subject: email,
          email,
          displayName: email.split('@')[0] || email,
          // Possession of the inbox (clicking the link) verifies the address itself.
          emailVerified: true,
        });
        if (user.created) {
          await repo.addTelemetry([
            { name: 'signup', anonId: null, userId: user.id, at: clock(), props: null },
          ]);
        }
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
        entitlements: req.user!.entitlements,
        preferences: req.user!.preferences,
      },
      csrfToken: req.csrfToken,
    });
  });

  // Save appearance preferences (theme, pixel/smooth art) at the account level, so they
  // follow the Light to any device. A merge-patch: omitted keys are left as they were.
  router.patch('/me/preferences', requireAuth, requireCsrf, (req: Request, res: Response, next) => {
    void (async () => {
      try {
        const parsed = UserPreferences.safeParse(req.body);
        if (!parsed.success) {
          res.status(400).json({ error: 'invalid preferences' });
          return;
        }
        const user = await repo.updatePreferences(req.user!.id, parsed.data);
        res.json({ preferences: user.preferences });
      } catch (err) {
        next(err);
      }
    })();
  });

  // The age gate (L2): the Light states its band once; under-13 is refused kindly at
  // the client and no band means no creatures (see routes/creatures.ts). 13+ only.
  router.post('/me/age', requireAuth, requireCsrf, (req: Request, res: Response, next) => {
    void (async () => {
      try {
        const band = String(req.body?.band ?? '');
        if (band !== '13-17' && band !== '18+') {
          return res.status(400).json({ error: 'band must be 13-17 or 18+' });
        }
        await repo.setAgeBand(req.user!.id, band);
        return res.json({ ageBand: band });
      } catch (err) {
        next(err);
      }
    })();
  });

  // Account deletion (L2): the right to be forgotten. The confirm phrase must match
  // the account email; everything owner-scoped is erased and the session ends.
  router.delete('/me', requireAuth, requireCsrf, (req: Request, res: Response, next) => {
    void (async () => {
      try {
        const confirm = String(req.body?.confirm ?? '');
        if (confirm.toLowerCase() !== req.user!.email.toLowerCase()) {
          return res.status(400).json({ error: 'type your account email to confirm' });
        }
        await repo.deleteUser(req.user!.id);
        clearSessionCookies(res);
        return res.status(204).end();
      } catch (err) {
        next(err);
      }
    })();
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

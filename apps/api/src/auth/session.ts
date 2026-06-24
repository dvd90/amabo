/**
 * auth/session.ts — cookie + CSRF helpers (ARCHITECTURE.md §14). Sessions are opaque
 * server-side tokens delivered as httpOnly + SameSite=Lax (+ Secure in prod) cookies.
 * CSRF uses the double-submit pattern: a readable token cookie that mutations must echo
 * back in the X-CSRF-Token header.
 */

import { randomBytes } from 'node:crypto';
import type { Request, Response } from 'express';

export const SESSION_COOKIE = 'amabo_session';
export const CSRF_COOKIE = 'amabo_csrf';
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export function newToken(): string {
  return randomBytes(32).toString('hex');
}

/** Parse the Cookie header into a map (no dependency on cookie-parser). */
export function parseCookies(req: Request): Record<string, string> {
  const header = req.headers.cookie;
  if (!header) return {};
  const out: Record<string, string> = {};
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i === -1) continue;
    const k = part.slice(0, i).trim();
    const v = part.slice(i + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  }
  return out;
}

export function setSessionCookies(
  res: Response,
  sessionId: string,
  csrfToken: string,
  secure: boolean,
): void {
  res.cookie(SESSION_COOKIE, sessionId, {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/',
    maxAge: SESSION_TTL_MS,
  });
  // Readable by the client so it can echo it back as a header (double-submit CSRF).
  res.cookie(CSRF_COOKIE, csrfToken, {
    httpOnly: false,
    sameSite: 'lax',
    secure,
    path: '/',
    maxAge: SESSION_TTL_MS,
  });
}

export function clearSessionCookies(res: Response): void {
  res.clearCookie(SESSION_COOKIE, { path: '/' });
  res.clearCookie(CSRF_COOKIE, { path: '/' });
}

/**
 * auth/magic.ts — magic-link tokens (ARCHITECTURE.md §14). A passwordless sign-in is
 * only safe if possession of the email address is PROVEN, so the email endpoint no
 * longer logs anyone in directly: it mails a short-lived, signed link, and only clicking
 * that link establishes a session. The token is stateless — `base64url(payload).HMAC` —
 * so it needs no extra table; an attacker can't forge one without the server secret, and
 * it expires quickly.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';

const sign = (payloadB64: string, secret: string): string =>
  createHmac('sha256', secret).update(payloadB64).digest('base64url');

/** Mint a signed token carrying the (lowercased) email and an absolute expiry (ms). */
export function makeMagicToken(email: string, expiresAt: number, secret: string): string {
  const payload = Buffer.from(JSON.stringify({ e: email.toLowerCase(), x: expiresAt })).toString(
    'base64url',
  );
  return `${payload}.${sign(payload, secret)}`;
}

/**
 * Verify a token. Returns the email iff the signature checks out (constant-time) AND it
 * has not expired; otherwise null. Never throws on malformed input.
 */
export function verifyMagicToken(token: string, now: number, secret: string): string | null {
  const dot = token.indexOf('.');
  if (dot < 1) return null;
  const payload = token.slice(0, dot);
  const got = Buffer.from(token.slice(dot + 1));
  const want = Buffer.from(sign(payload, secret));
  if (got.length !== want.length || !timingSafeEqual(got, want)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString()) as {
      e?: unknown;
      x?: unknown;
    };
    if (typeof data.e !== 'string' || typeof data.x !== 'number') return null;
    if (now > data.x) return null;
    return data.e;
  } catch {
    return null;
  }
}

/**
 * cors.ts — minimal credentialed CORS for the two-service deploy (web and API on
 * different origins). Echoes the single allowed web origin, allows credentials (so the
 * session cookie rides along) and the CSRF header, and answers preflight. No dependency.
 * Omit the origin (single-origin deploy) and this is a no-op.
 */

import type { NextFunction, Request, Response } from 'express';

export function cors(allowedOrigin: string | undefined) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!allowedOrigin) return next();
    const origin = req.headers.origin;
    if (origin === allowedOrigin) {
      res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-CSRF-Token');
      res.setHeader('Access-Control-Max-Age', '600');
    }
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  };
}

/**
 * InscribeHandoff.tsx — the device's half of an inscription (ARCHITECTURE.md §13).
 *
 * The Sky (www) knows the wallet; the device (app) knows the Light. So the Sky sends
 * the Light here — `/inscribe?star=…&to=0x…&seat=…&return=https://www…/claim` — the
 * device asks its own API for the signed voucher (same origin, session cookie, CSRF),
 * and hands the Light straight back to the Sky with the voucher in the URL fragment.
 * No wallet code lives in the device; no game session ever reaches the Sky.
 */

import { useEffect, useState } from 'react';
import type { InscribeStarResponseT } from '@amabo/shared';
import { useGame } from '../store/useGame.js';

export interface HandoffParams {
  star: string;
  to: string;
  tokenId: string;
  returnTo: string;
}

/** Parse the handoff query. `skyUrl` is the only origin we will ever send a voucher to. */
export function parseHandoff(
  search: string,
  skyUrl: string | undefined,
): { ok: true; params: HandoffParams } | { ok: false; error: string } {
  const q = new URLSearchParams(search);
  const star = q.get('star') ?? '';
  const to = q.get('to') ?? '';
  const tokenId = q.get('seat') || '0';
  const returnTo = q.get('return') ?? '';
  if (!skyUrl) return { ok: false, error: 'This Amarium has no Sky to inscribe into.' };
  if (!star) return { ok: false, error: 'No star named.' };
  if (!/^0x[0-9a-fA-F]{40}$/.test(to)) return { ok: false, error: 'That is not a wallet.' };
  if (!/^\d+$/.test(tokenId)) return { ok: false, error: 'That is not a seat.' };
  if (!returnTo.startsWith(skyUrl.replace(/\/$/, '') + '/')) {
    return { ok: false, error: 'The way back does not lead to the Sky.' };
  }
  return { ok: true, params: { star, to, tokenId, returnTo } };
}

/** URL-safe base64 of the voucher response — the Sky decodes it from `#v=`. */
export function encodeVoucher(r: InscribeStarResponseT): string {
  const json = JSON.stringify(r);
  const b64 = btoa(String.fromCharCode(...new TextEncoder().encode(json)));
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function InscribeHandoff({
  params,
  navigate = (url) => window.location.replace(url),
}: {
  params: HandoffParams;
  navigate?: (url: string) => void;
}) {
  const client = useGame((s) => s.client);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    client
      .inscribeStar(params.star, { to: params.to, tokenId: params.tokenId })
      .then((r) => {
        if (live) navigate(`${params.returnTo}#v=${encodeVoucher(r)}`);
      })
      .catch(() => {
        if (live) setError('The glass could not vouch for that star — is it yours, and ascended?');
      });
    return () => {
      live = false;
    };
  }, [client, navigate, params]);

  return (
    <section className="handoff">
      <p>{error ?? 'Asking the glass to vouch for your star…'}</p>
    </section>
  );
}

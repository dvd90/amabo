// The Sky's small vocabulary (STORY.md §7½, ARCHITECTURE.md §13). Pure helpers + the one
// public read the Sky makes of the game API. No wallet, no session, no secrets here.
import type { Address, Hex } from 'viem';
import { API_BASE } from './robinhood';

/** Mirror of `StarNFT.Kind`. */
export const Kind = { Unnamed: 0, Inscribed: 1 } as const;

/** The public record of a star (the API's StarSchema — never an owner). */
export interface StarRecord {
  name: string;
  bornAt: number;
  graduatedAt: number;
  finalTraits: Record<string, number>;
  constellationPos: { x: number; y: number };
}

export interface SkyStar {
  star: StarRecord;
  soul: Hex;
  metadataHash: Hex;
}

/** Mirror of `StarNFT.Inscription` as the API returns it (numbers as decimal strings). */
export interface Voucher {
  tokenId: string;
  to: Address;
  creatureId: Hex;
  metadataHash: Hex;
  deadline: number;
}

export interface VoucherResponse {
  voucher: Voucher;
  signature: Hex;
  domain: { name: string; version: string; chainId: number; verifyingContract: Address };
  signer: Address;
  metadata: StarRecord;
}

/** A soul is the creature's uuid left-aligned in bytes32 — reversible by design. */
export function creatureIdOfSoul(soul: string): string | null {
  const m = /^0x([0-9a-f]{32})0{32}$/i.exec(soul);
  if (!m) return null;
  const h = m[1].toLowerCase();
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** GET /sky/stars/:id — public, credential-free. Null when the Sky has no record. */
export async function fetchStar(idOrSoul: string): Promise<SkyStar | null> {
  try {
    const res = await fetch(`${API_BASE}/sky/stars/${encodeURIComponent(idOrSoul)}`);
    if (!res.ok) return null;
    return (await res.json()) as SkyStar;
  } catch {
    return null;
  }
}

/** The device hands the Light back with `#v=<base64url JSON>`; decode it or nothing. */
export function decodeVoucher(hash: string): VoucherResponse | null {
  const m = /[#&]v=([A-Za-z0-9_-]+)/.exec(hash);
  if (!m) return null;
  try {
    const b64 = m[1].replace(/-/g, '+').replace(/_/g, '/');
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const r = JSON.parse(new TextDecoder().decode(bytes)) as Partial<VoucherResponse>;
    if (!r.voucher || !r.signature || !r.domain || !r.metadata) return null;
    return r as VoucherResponse;
  } catch {
    return null;
  }
}

/** Days a soul shone, never fewer than one. */
export function shone(star: StarRecord): number {
  return Math.max(1, Math.round((star.graduatedAt - star.bornAt) / 86_400_000));
}

const GLYPHS = ['✦', '✧', '✶', '✷', '✸', '✹', '⋆', '✵'];

/** A star's glyph, struck from its soul (or a seat's id) — no two lights quite alike. */
export function glyph(seed: string): string {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return GLYPHS[h % GLYPHS.length];
}

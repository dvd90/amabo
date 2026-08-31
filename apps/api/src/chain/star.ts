/**
 * chain/star.ts — the one wire between the game and the Sky (ARCHITECTURE.md §13).
 *
 * The API never touches a wallet or the chain. It signs an EIP-712 *Inscription
 * voucher* for a star the signed-in Light raised; the Sky's `StarNFT.inscribe()`
 * recovers the signature and strikes (or names) the star. The typed data here must
 * match `StarNFT.INSCRIPTION_TYPEHASH` byte for byte — a pinned vector in both test
 * suites keeps them honest.
 *
 * Off by default: with no signer configured the route does not exist.
 */

import { keccak256, stringToHex, type Address, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { StarSchema } from '@amabo/shared';
import type { Star } from '@amabo/engine';

/** Robinhood Chain (VERIFY against official docs before a real deploy). */
export const STAR_CHAIN_ID = 4663;
/** How long a voucher stays valid once issued — long enough to sign a tx, short enough to forget. */
export const VOUCHER_TTL_SECONDS = 15 * 60;

/** Mirror of `StarNFT.Inscription` — field names and order are part of the signature. */
export const INSCRIPTION_TYPES = {
  Inscription: [
    { name: 'tokenId', type: 'uint256' },
    { name: 'to', type: 'address' },
    { name: 'creatureId', type: 'bytes32' },
    { name: 'metadataHash', type: 'bytes32' },
    { name: 'deadline', type: 'uint256' },
  ],
} as const;

export interface InscriptionVoucher {
  /** "0" strikes a new star; otherwise the unnamed seat the Light holds and wants to name. */
  tokenId: string;
  to: Address;
  creatureId: Hex;
  metadataHash: Hex;
  /** Unix seconds. */
  deadline: number;
}

export interface StarDomain {
  name: string;
  version: '1';
  chainId: number;
  verifyingContract: Address;
}

/** What the API needs from a signer; the noop posture is simply `undefined`. */
export interface StarSigner {
  readonly address: Address;
  readonly domain: StarDomain;
  sign(voucher: InscriptionVoucher): Promise<Hex>;
}

/** The EIP-712 domain `StarNFT.initialize(name_, …)` + `__EIP712_init(name_, "1")` sets up. */
export function starDomain(o: { chainId?: number; contract: Address; name?: string }): StarDomain {
  return {
    name: o.name ?? 'Star',
    version: '1',
    chainId: o.chainId ?? STAR_CHAIN_ID,
    verifyingContract: o.contract,
  };
}

/**
 * A creature's soul on the wire: its uuid, left-aligned in 32 bytes. Reversible on
 * purpose — the Sky maps `creatureOf(tokenId)` straight back to a creature id.
 */
export function soulOf(creatureId: string): Hex {
  const hex = creatureId.replace(/-/g, '');
  if (!/^[0-9a-f]{32}$/i.test(hex)) throw new Error(`not a creature id: ${creatureId}`);
  return `0x${hex.toLowerCase()}${'0'.repeat(32)}`;
}

export function creatureIdOfSoul(soul: string): string | null {
  const m = /^0x([0-9a-f]{32})0{32}$/i.exec(soul);
  if (!m) return null;
  const h = m[1]!.toLowerCase();
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export type StarMetadata = Star;

/** The public record of a star — exactly `StarSchema`, nothing about its owner. */
export function starMetadata(star: Star): StarMetadata {
  return StarSchema.parse(star);
}

/** keccak256 of the canonical JSON (sorted keys) so any renderer can re-derive it. */
export function hashStarMetadata(meta: StarMetadata): Hex {
  return keccak256(stringToHex(canonical(meta)));
}

function canonical(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`;
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    return `{${Object.keys(o)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonical(o[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(v);
}

/** A signer backed by a raw private key (STAR_SIGNER_KEY): a dedicated hot key, rotated on-chain via `setSigner`. */
export function viemStarSigner(o: {
  privateKey: Hex;
  contract: Address;
  chainId?: number;
  name?: string;
}): StarSigner {
  const account = privateKeyToAccount(o.privateKey);
  const domain = starDomain(o);
  return {
    address: account.address,
    domain,
    sign: (v) =>
      account.signTypedData({
        domain,
        types: INSCRIPTION_TYPES,
        primaryType: 'Inscription',
        message: {
          tokenId: BigInt(v.tokenId),
          to: v.to,
          creatureId: v.creatureId,
          metadataHash: v.metadataHash,
          deadline: BigInt(v.deadline),
        },
      }),
  };
}

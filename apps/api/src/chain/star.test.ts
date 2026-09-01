/**
 * chain/star.test.ts — the wire between the game API and the Sky's StarNFT
 * (ARCHITECTURE.md §13). The API signs an EIP-712 Inscription voucher; the contract
 * recovers it. Byte-for-byte agreement is pinned by a vector shared with the Foundry
 * suite (test_DigestMatchesTheApiVector).
 */

import { describe, expect, it } from 'vitest';
import { hashTypedData, recoverTypedDataAddress, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import {
  INSCRIPTION_TYPES,
  creatureIdOfSoul,
  hashStarMetadata,
  soulOf,
  starDomain,
  starMetadata,
  viemStarSigner,
} from './star.js';

// anvil account 0 — a public test key, never a real one.
const ANVIL0 = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80' as const;
const FIXED_STAR = '0x000000000000000000000000000000000000057a' as const;
const PINNED_DIGEST = '0x392ea2f2e495cc6f792ffff6ac4b235eddab16aeb5c51b6ac5db1391a17c2cf0';

describe('the soul on the wire', () => {
  it('a soul is the creature id itself, left-aligned in 32 bytes, and reversible', () => {
    const id = '123e4567-e89b-12d3-a456-426614174000';
    const soul = soulOf(id);
    expect(soul).toBe('0x123e4567e89b12d3a456426614174000' + '0'.repeat(32));
    expect(creatureIdOfSoul(soul)).toBe(id);
    expect(creatureIdOfSoul(soul.toUpperCase().replace('0X', '0x'))).toBe(id);
    expect(creatureIdOfSoul('0x' + '1'.repeat(64))).toBeNull();
    expect(creatureIdOfSoul('nope')).toBeNull();
    expect(() => soulOf('not-a-uuid')).toThrow();
  });

  it('the metadata hash is canonical: only public fields, key order irrelevant', () => {
    const star = {
      id: 's1',
      creatureId: 'c1',
      ownerId: 'u1',
      name: 'Pip',
      bornAt: 1,
      graduatedAt: 2,
      finalTraits: { warmth: 0.9, curiosity: 0.4 },
      constellationPos: { x: 0.1, y: 0.2 },
    };
    const meta = starMetadata(star);
    expect(Object.keys(meta).sort()).toEqual([
      'bornAt',
      'constellationPos',
      'finalTraits',
      'graduatedAt',
      'name',
    ]);
    const swapped = { ...meta, finalTraits: { curiosity: 0.4, warmth: 0.9 } };
    expect(hashStarMetadata(swapped)).toBe(hashStarMetadata(meta));
    expect(hashStarMetadata({ ...meta, name: 'Pop' })).not.toBe(hashStarMetadata(meta));
    expect(hashStarMetadata(meta)).toMatch(/^0x[0-9a-f]{64}$/);
  });
});

describe('the voucher signer', () => {
  const voucher = {
    tokenId: '0',
    to: '0x1111111111111111111111111111111111111111',
    creatureId: `0x${'22'.repeat(32)}` as Hex,
    metadataHash: `0x${'33'.repeat(32)}` as Hex,
    deadline: 1_700_000_000,
  } as const;

  it('hashes typed data exactly as StarNFT.hashInscription (pinned vector)', () => {
    const digest = hashTypedData({
      domain: starDomain({ chainId: 4663, contract: FIXED_STAR }),
      types: INSCRIPTION_TYPES,
      primaryType: 'Inscription',
      message: {
        tokenId: BigInt(voucher.tokenId),
        to: voucher.to,
        creatureId: voucher.creatureId,
        metadataHash: voucher.metadataHash,
        deadline: BigInt(voucher.deadline),
      },
    });
    expect(digest).toBe(PINNED_DIGEST);
  });

  it('signs a voucher the contract will recover to the signer', async () => {
    const signer = viemStarSigner({ privateKey: ANVIL0, contract: FIXED_STAR, chainId: 4663 });
    expect(signer.address).toBe(privateKeyToAccount(ANVIL0).address);
    expect(signer.domain).toEqual({
      name: 'Star',
      version: '1',
      chainId: 4663,
      verifyingContract: FIXED_STAR,
    });
    const signature = await signer.sign(voucher);
    const recovered = await recoverTypedDataAddress({
      domain: signer.domain,
      types: INSCRIPTION_TYPES,
      primaryType: 'Inscription',
      message: {
        tokenId: 0n,
        to: voucher.to,
        creatureId: voucher.creatureId,
        metadataHash: voucher.metadataHash,
        deadline: 1_700_000_000n,
      },
      signature,
    });
    expect(recovered).toBe(signer.address);
  });

  it('honours a custom collection name in the domain', () => {
    const signer = viemStarSigner({ privateKey: ANVIL0, contract: FIXED_STAR, name: 'Amarium' });
    expect(signer.domain.name).toBe('Amarium');
    expect(signer.domain.chainId).toBe(4663);
  });
});

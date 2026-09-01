/**
 * routes/stars.test.ts — POST /stars/:id/inscribe (ARCHITECTURE.md §13). The one bridge
 * between the game and the Sky: an owner asks for a voucher for a star they raised; the
 * API signs it; the Sky's StarNFT recovers it. Off by default (no signer = no route).
 */

import { describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { recoverTypedDataAddress } from 'viem';
import { createApp } from '../app.js';
import { FakeAuthProvider } from '../auth/provider.js';
import { localNarrator } from '../narrate/port.js';
import { InMemoryRepository } from '../repo/memory.js';
import {
  INSCRIPTION_TYPES,
  VOUCHER_TTL_SECONDS,
  creatureIdOfSoul,
  hashStarMetadata,
  soulOf,
  starMetadata,
  viemStarSigner,
} from '../chain/star.js';

const ANVIL0 = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80' as const;
const STAR_CONTRACT = '0x000000000000000000000000000000000000057a' as const;
const WALLET = '0x1111111111111111111111111111111111111111';
const NOW_MS = 1_000_000_000;

function setup(chainOn = true) {
  const repo = new InMemoryRepository();
  const app = createApp({
    repo,
    clock: () => NOW_MS,
    seed: () => 1,
    narrator: localNarrator,
    authProvider: new FakeAuthProvider(),
    cookieSecure: false,
    baseUrl: 'http://localhost',
    starSigner: chainOn
      ? viemStarSigner({ privateKey: ANVIL0, contract: STAR_CONTRACT, chainId: 4663 })
      : undefined,
  });
  return { repo, app };
}

async function login(app: Express, code = 'pip') {
  const agent = request.agent(app);
  const start = await agent.get('/auth/google');
  const state = new URL(start.headers.location!).searchParams.get('state') ?? '';
  await agent.get('/auth/callback').query({ code, state });
  const me = await agent.get('/me');
  return { agent, csrf: me.body.csrfToken as string, userId: me.body.user.id as string };
}

async function ascend(repo: InMemoryRepository, ownerId: string) {
  return repo.addStar({
    creatureId: '123e4567-e89b-12d3-a456-426614174000',
    ownerId,
    name: 'Pip',
    bornAt: 1,
    graduatedAt: 2,
    finalTraits: { warmth: 0.9 },
    constellationPos: { x: 0.1, y: 0.2 },
  });
}

describe('POST /stars/:id/inscribe — the voucher', () => {
  it('is unreachable while the Sky is off (no signer configured)', async () => {
    const { app, repo } = setup(false);
    const { agent, csrf, userId } = await login(app);
    const star = await ascend(repo, userId);
    const res = await agent
      .post(`/stars/${star.id}/inscribe`)
      .set('x-csrf-token', csrf)
      .send({ to: WALLET });
    expect(res.status).toBe(404);
  });

  it('requires a session', async () => {
    const { app } = setup();
    expect((await request(app).post('/stars/x/inscribe').send({ to: WALLET })).status).toBe(401);
  });

  it("is owner-scoped: another Light's star is simply not found", async () => {
    const { app, repo } = setup();
    const alice = await login(app, 'alice');
    const star = await ascend(repo, alice.userId);
    const bob = await login(app, 'bob');
    const res = await bob.agent
      .post(`/stars/${star.id}/inscribe`)
      .set('x-csrf-token', bob.csrf)
      .send({ to: WALLET });
    expect(res.status).toBe(404);
  });

  it('rejects a malformed wallet or token id (400)', async () => {
    const { app, repo } = setup();
    const { agent, csrf, userId } = await login(app);
    const star = await ascend(repo, userId);
    const bad = (body: object) =>
      agent.post(`/stars/${star.id}/inscribe`).set('x-csrf-token', csrf).send(body);
    expect((await bad({ to: 'not-a-wallet' })).status).toBe(400);
    expect((await bad({ to: WALLET, tokenId: '-1' })).status).toBe(400);
    expect((await bad({ to: WALLET, tokenId: 7 })).status).toBe(400);
    expect((await bad({})).status).toBe(400);
  });

  it('issues a voucher bound to the soul, the wallet, and the clock — and signs it', async () => {
    const { app, repo } = setup();
    const { agent, csrf, userId } = await login(app);
    const star = await ascend(repo, userId);

    const res = await agent
      .post(`/stars/${star.id}/inscribe`)
      .set('x-csrf-token', csrf)
      .send({ to: WALLET });
    expect(res.status).toBe(200);

    const { voucher, signature, domain, signer, metadata } = res.body;
    expect(voucher).toEqual({
      tokenId: '0',
      to: WALLET,
      creatureId: soulOf(star.creatureId),
      metadataHash: hashStarMetadata(starMetadata(star)),
      deadline: NOW_MS / 1000 + VOUCHER_TTL_SECONDS,
    });
    expect(metadata).toEqual(starMetadata(star));
    expect(metadata).not.toHaveProperty('ownerId');
    expect(domain).toEqual({
      name: 'Star',
      version: '1',
      chainId: 4663,
      verifyingContract: STAR_CONTRACT,
    });
    const recovered = await recoverTypedDataAddress({
      domain,
      types: INSCRIPTION_TYPES,
      primaryType: 'Inscription',
      message: {
        tokenId: BigInt(voucher.tokenId),
        to: voucher.to,
        creatureId: voucher.creatureId,
        metadataHash: voucher.metadataHash,
        deadline: BigInt(voucher.deadline),
      },
      signature,
    });
    expect(recovered).toBe(signer);
  });

  it('names a seat the Light already holds when a tokenId is given', async () => {
    const { app, repo } = setup();
    const { agent, csrf, userId } = await login(app);
    const star = await ascend(repo, userId);
    const res = await agent
      .post(`/stars/${star.id}/inscribe`)
      .set('x-csrf-token', csrf)
      .send({ to: WALLET, tokenId: '7' });
    expect(res.status).toBe(200);
    expect(res.body.voucher.tokenId).toBe('7');
  });
});

describe('GET /sky/stars/:id — the public record the Sky renders', () => {
  it('is unreachable while the Sky is off', async () => {
    const { app, repo } = setup(false);
    const star = await ascend(repo, 'someone');
    // With no signer the route is not mounted: it answers exactly like a path that
    // never existed (the auth gate speaks for the unknown), never 200.
    const res = await request(app).get(`/sky/stars/${star.creatureId}`);
    expect(res.status).toBe((await request(app).get('/no-such-route')).status);
    expect(res.status).not.toBe(200);
  });

  it('serves the public record and its hash — no session, no owner', async () => {
    const { app, repo } = setup();
    const star = await ascend(repo, 'someone-private');
    const res = await request(app).get(`/sky/stars/${star.creatureId}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      star: starMetadata(star),
      soul: soulOf(star.creatureId),
      metadataHash: hashStarMetadata(starMetadata(star)),
    });
    expect(JSON.stringify(res.body)).not.toContain('someone-private');
    // Public data, no credentials: the Sky (another origin) may read it from the browser.
    expect(res.headers['access-control-allow-origin']).toBe('*');
  });

  it('accepts the on-chain soul (bytes32) as well as the creature id', async () => {
    const { app, repo } = setup();
    const star = await ascend(repo, 'u1');
    const soul = soulOf(star.creatureId);
    expect(creatureIdOfSoul(soul)).toBe(star.creatureId);
    const res = await request(app).get(`/sky/stars/${soul}`);
    expect(res.status).toBe(200);
    expect(res.body.star.name).toBe('Pip');
  });

  it('is simply not found for an unknown or malformed id', async () => {
    const { app } = setup();
    expect((await request(app).get('/sky/stars/nope')).status).toBe(404);
    expect((await request(app).get('/sky/stars/00000000-0000-4000-8000-000000000000')).status).toBe(
      404,
    );
  });
});

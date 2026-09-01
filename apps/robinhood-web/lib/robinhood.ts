// Single source of truth for Robinhood Chain constants in the frontend.
// Mirror of packages/robinhood-contracts/src/Constants.sol. Chain facts verified 2026-08-31
// against docs.robinhood.com/chain/connecting + cast (SKY_RUNBOOK.md §2). No other file may
// hold an address literal.
import { defineChain, type Address } from 'viem';
import deployments from '../../../packages/robinhood-contracts/deployments/4663.json';

// Verified: mainnet chain ID 4663 (testnet is 46630). NEXT_PUBLIC_ROBINHOOD_CHAIN_ID overrides
// for a testnet rehearsal (SKY_RUNBOOK.md §2) — together with the RPC/explorer URLs and the
// NEXT_PUBLIC_STAR_ADDRESS / NEXT_PUBLIC_LUMEN_ADDRESS overrides below.
export const ROBINHOOD_CHAIN_ID = Number(process.env.NEXT_PUBLIC_ROBINHOOD_CHAIN_ID ?? 4663);

// Verified RPC/explorer (official docs). The public RPC is rate-limited — set
// NEXT_PUBLIC_ROBINHOOD_RPC_URL to a provider URL (Alchemy et al.) for production traffic.
export const robinhoodChain = defineChain({
  id: ROBINHOOD_CHAIN_ID,
  name: 'Robinhood Chain',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: {
      http: [
        process.env.NEXT_PUBLIC_ROBINHOOD_RPC_URL ?? 'https://rpc.mainnet.chain.robinhood.com',
      ],
    },
  },
  blockExplorers: {
    default: {
      name: 'Blockscout',
      url:
        process.env.NEXT_PUBLIC_ROBINHOOD_EXPLORER_URL ?? 'https://robinhoodchain.blockscout.com',
    },
  },
});

// Verified: canonical ERC-6551 registry, deployed on 4663 (cast code, 2026-08-31).
export const ERC6551_REGISTRY = '0x000000006551c19487814612e58FE06813775758' as const;

// Verified: Tokenbound AccountV3, deployed on 4663 (NOT on testnet 46630 — deploy your own there).
export const ERC6551_ACCOUNT_IMPL = '0x41C8f39463A868d3A88af00cd0fe7102F30E44eC' as const;

// Written by contracts/script/Deploy.s.sol. Zero address = not deployed yet.
export const NFT_ADDRESS = deployments.nft as Address;
export const VAULT_ADDRESS = deployments.vault as Address;
export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as const;
const isAddress = (s: string | undefined): s is Address => !!s && /^0x[0-9a-fA-F]{40}$/.test(s);
export const IS_DEPLOYED =
  deployments.chainId === ROBINHOOD_CHAIN_ID && NFT_ADDRESS !== ZERO_ADDRESS;

// VERIFY: tokenised-stock reward tokens on 4663 — from official docs, via env.
export const REWARD_TOKENS = (process.env.NEXT_PUBLIC_REWARD_TOKENS ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter((s): s is Address => /^0x[0-9a-fA-F]{40}$/.test(s));

// ── The Sky (ARCHITECTURE.md §13) ──────────────────────────────────────────────
// Written by Deploy.s.sol (`star`). Zero address = the Sky is not deployed yet.
// An env override wins (a testnet rehearsal deploys to deployments/46630.json, which this
// build does not import); otherwise the committed mainnet deployment.
const starEnv = process.env.NEXT_PUBLIC_STAR_ADDRESS;
const lumenEnv = process.env.NEXT_PUBLIC_LUMEN_ADDRESS;
export const STAR_ADDRESS: Address = isAddress(starEnv) ? starEnv : (deployments.star as Address);
/** Lumen, the Sky's coin (STORY.md §7½) — plain ERC-20; zero = not deployed. */
export const LUMEN_ADDRESS: Address = isAddress(lumenEnv)
  ? lumenEnv
  : (deployments.lumen as Address);
export const IS_SKY_DEPLOYED =
  STAR_ADDRESS !== ZERO_ADDRESS &&
  (isAddress(starEnv) || deployments.chainId === ROBINHOOD_CHAIN_ID);
/** The game API's origin — the Sky reads public star records from it, nothing else. */
export const API_BASE = (process.env.NEXT_PUBLIC_API_BASE ?? 'https://www.theamarium.com').replace(
  /\/$/,
  '',
);
/** The device — where a Light signs in and the glass vouches for a star. */
export const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.theamarium.com').replace(
  /\/$/,
  '',
);

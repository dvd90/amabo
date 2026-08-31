// Single source of truth for Robinhood Chain constants in the frontend.
// Mirror of contracts/src/Constants.sol. Every value is VERIFY-tagged until confirmed against
// official Robinhood Chain docs and the block explorer. No other file may hold an address literal.
import { defineChain, type Address } from 'viem';
import deployments from '../../../packages/robinhood-contracts/deployments/4663.json';

// VERIFY: chain ID from official docs / chainlist.
export const ROBINHOOD_CHAIN_ID = 4663 as const;

// VERIFY: name, native currency, RPC + explorer URLs from official docs. URLs come from env.
export const robinhoodChain = defineChain({
  id: ROBINHOOD_CHAIN_ID,
  name: 'Robinhood Chain',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: [process.env.NEXT_PUBLIC_ROBINHOOD_RPC_URL ?? ''] } },
  blockExplorers: {
    default: { name: 'Blockscout', url: process.env.NEXT_PUBLIC_ROBINHOOD_EXPLORER_URL ?? '' },
  },
});

// VERIFY: canonical ERC-6551 registry; confirm deployed on 4663.
export const ERC6551_REGISTRY = '0x000000006551c19487814612e58FE06813775758' as const;

// VERIFY: ERC-6551 account implementation (Tokenbound AccountV3); confirm deployed on 4663.
export const ERC6551_ACCOUNT_IMPL = '0x41C8f39463A868d3A88af00cd0fe7102F30E44eC' as const;

// Written by contracts/script/Deploy.s.sol. Zero address = not deployed yet.
export const NFT_ADDRESS = deployments.nft as Address;
export const VAULT_ADDRESS = deployments.vault as Address;
export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as const;
export const IS_DEPLOYED =
  deployments.chainId === ROBINHOOD_CHAIN_ID && NFT_ADDRESS !== ZERO_ADDRESS;

// VERIFY: tokenised-stock reward tokens on 4663 — from official docs, via env.
export const REWARD_TOKENS = (process.env.NEXT_PUBLIC_REWARD_TOKENS ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter((s): s is Address => /^0x[0-9a-fA-F]{40}$/.test(s));

// ── The Sky (ARCHITECTURE.md §13) ──────────────────────────────────────────────
// Written by Deploy.s.sol (`star`). Zero address = the Sky is not deployed yet.
export const STAR_ADDRESS = deployments.star as Address;
/** Lumen, the Sky's coin (STORY.md §7½) — plain ERC-20; zero = not deployed. */
export const LUMEN_ADDRESS = deployments.lumen as Address;
export const IS_SKY_DEPLOYED =
  deployments.chainId === ROBINHOOD_CHAIN_ID && STAR_ADDRESS !== ZERO_ADDRESS;
/** The game API's origin — the Sky reads public star records from it, nothing else. */
export const API_BASE = (process.env.NEXT_PUBLIC_API_BASE ?? 'https://app.theamarium.com').replace(
  /\/$/,
  '',
);
/** The device — where a Light signs in and the glass vouches for a star. */
export const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.theamarium.com').replace(
  /\/$/,
  '',
);

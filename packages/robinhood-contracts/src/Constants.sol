// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title Constants
/// @notice Single source of truth for Robinhood Chain (chain ID 4663) addresses.
/// @dev Chain facts VERIFIED 2026-08-31 against docs.robinhood.com/chain/connecting and
///      `cast` against the official RPCs (see docs/SKY_RUNBOOK.md §2). Remaining VERIFY
///      tags are genuinely unknown. Mirror of apps/robinhood-web/lib/robinhood.ts.
library Constants {
    // Verified: mainnet chain ID 4663 (cast chain-id, official docs). Testnet is 46630.
    uint256 internal constant CHAIN_ID = 4663;

    // Verified: canonical ERC-6551 registry, deployed on 4663 AND on testnet 46630
    // (cast code non-empty on both, 2026-08-31).
    address internal constant ERC6551_REGISTRY = 0x000000006551c19487814612e58FE06813775758;

    // Verified: Tokenbound AccountV3, deployed on 4663 (cast code non-empty, 2026-08-31).
    // NOT deployed on testnet 46630 — deploy erc6551/examples/simple/ERC6551Account.sol
    // yourself there and pass ERC6551_ACCOUNT_IMPL to Deploy.s.sol.
    address internal constant ERC6551_ACCOUNT_IMPL = 0x41C8f39463A868d3A88af00cd0fe7102F30E44eC;

    // VERIFY: tokenised-stock reward tokens on 4663 — unknown, fill from official Robinhood Chain docs.
    address internal constant STOCK_TOKEN_EXAMPLE = address(0);

    // VERIFY: Uniswap router on 4663 — unknown, fill from official docs.
    address internal constant UNISWAP_ROUTER = address(0);
}

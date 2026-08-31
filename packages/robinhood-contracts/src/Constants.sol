// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title Constants
/// @notice Single source of truth for Robinhood Chain (chain ID 4663) addresses.
/// @dev Every value here is VERIFY-tagged: confirm against official Robinhood Chain docs and the
///      block explorer before any real deploy, then drop the tag. Mirror of apps/web/lib/robinhood.ts.
library Constants {
    // VERIFY: Robinhood Chain chain ID (project notes; confirm in official docs / chainlist).
    uint256 internal constant CHAIN_ID = 4663;

    // VERIFY: canonical ERC-6551 registry (same address on every chain, https://eips.ethereum.org/EIPS/eip-6551).
    //         Confirm it is actually deployed on 4663 via the explorer.
    address internal constant ERC6551_REGISTRY = 0x000000006551c19487814612e58FE06813775758;

    // VERIFY: ERC-6551 account implementation (Tokenbound AccountV3, https://docs.tokenbound.org).
    //         Confirm deployment on 4663 or deploy `erc6551/examples/simple/ERC6551Account.sol` yourself.
    address internal constant ERC6551_ACCOUNT_IMPL = 0x41C8f39463A868d3A88af00cd0fe7102F30E44eC;

    // VERIFY: tokenised-stock reward tokens on 4663 — unknown, fill from official Robinhood Chain docs.
    address internal constant STOCK_TOKEN_EXAMPLE = address(0);

    // VERIFY: Uniswap router on 4663 — unknown, fill from official docs.
    address internal constant UNISWAP_ROUTER = address(0);
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IWeightStrategy} from "./IWeightStrategy.sol";
import {MembershipNFT} from "../MembershipNFT.sol";

/// @title TenureWeightStrategy
/// @notice Reference non-trivial strategy: weight = 1 + full `period`s the current owner has held
///         the token (`MembershipNFT.heldSince` resets on every transfer). Swappable into the vault
///         with zero vault changes — copy this file to build your own game logic.
contract TenureWeightStrategy is IWeightStrategy {
    error ZeroPeriod();

    uint256 public immutable period;

    constructor(uint256 period_) {
        if (period_ == 0) revert ZeroPeriod();
        period = period_;
    }

    function weightOf(address nft, uint256 tokenId) external view returns (uint256) {
        return 1 + (block.timestamp - MembershipNFT(nft).heldSince(tokenId)) / period;
    }
}

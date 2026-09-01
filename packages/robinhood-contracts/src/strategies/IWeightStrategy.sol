// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IWeightStrategy
/// @notice Pluggable holder-weight function. All game logic (levels, tenure, ...) lives behind
///         this interface; RevenueVault only ever reads weights through it (CLAUDE.md rule 2).
interface IWeightStrategy {
    /// @return weight Relative share weight of `tokenId` on `nft`. 0 excludes it from a round.
    function weightOf(address nft, uint256 tokenId) external view returns (uint256 weight);
}

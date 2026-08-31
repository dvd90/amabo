// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IWeightStrategy} from "./IWeightStrategy.sol";

/// @title EqualWeightStrategy
/// @notice Default strategy: every token weighs 1, so every holder gets an equal share.
contract EqualWeightStrategy is IWeightStrategy {
    function weightOf(address, uint256) external pure returns (uint256) {
        return 1;
    }
}

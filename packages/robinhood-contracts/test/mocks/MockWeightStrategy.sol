// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IWeightStrategy} from "../../src/strategies/IWeightStrategy.sol";

/// Settable per-token weights; unset tokens fall back to `defaultWeight`.
contract MockWeightStrategy is IWeightStrategy {
    uint256 public defaultWeight = 1;
    mapping(uint256 => uint256) internal weights;
    mapping(uint256 => bool) internal isSet;
    uint256 public reads;

    function setWeight(uint256 tokenId, uint256 weight) external {
        weights[tokenId] = weight;
        isSet[tokenId] = true;
    }

    function setDefaultWeight(uint256 weight) external {
        defaultWeight = weight;
    }

    function weightOf(address, uint256 tokenId) external view returns (uint256) {
        return isSet[tokenId] ? weights[tokenId] : defaultWeight;
    }
}

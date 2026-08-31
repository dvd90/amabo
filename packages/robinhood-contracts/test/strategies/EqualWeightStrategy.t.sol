// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Fixture} from "../utils/Fixture.sol";
import {EqualWeightStrategy} from "../../src/strategies/EqualWeightStrategy.sol";

contract EqualWeightStrategyTest is Fixture {
    EqualWeightStrategy equal;

    function setUp() public override {
        super.setUp();
        equal = new EqualWeightStrategy();
        vault.setStrategy(address(equal));
    }

    function testFuzz_EveryTokenWeighsOne(address anyNft, uint256 tokenId) public view {
        assertEq(equal.weightOf(anyNft, tokenId), 1);
    }

    function test_EqualSplitAcrossHolders() public {
        uint256[4] memory ids;
        for (uint256 i; i < 4; i++) {
            ids[i] = _mint(makeAddr(string(abi.encodePacked("holder", i))));
        }
        _deposit(token, 401);
        vault.distribute(address(token));
        _claimAll(address(token));
        for (uint256 i; i < 4; i++) {
            assertEq(token.balanceOf(_tba(ids[i])), 100);
        }
        assertEq(vault.distributable(address(token)), 1);
    }
}

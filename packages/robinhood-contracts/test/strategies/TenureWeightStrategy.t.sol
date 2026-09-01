// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Fixture} from "../utils/Fixture.sol";
import {TenureWeightStrategy} from "../../src/strategies/TenureWeightStrategy.sol";

/// Reference non-trivial strategy: weight = 1 + full periods the current owner has held the token.
/// Proves the vault needs no changes to swap strategies.
contract TenureWeightStrategyTest is Fixture {
    uint256 constant PERIOD = 1 days;
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    TenureWeightStrategy tenure;

    function setUp() public override {
        super.setUp();
        tenure = new TenureWeightStrategy(PERIOD);
        vault.setStrategy(address(tenure));
    }

    function test_WeightGrowsWithTenure() public {
        uint256 a = _mint(alice);
        assertEq(tenure.weightOf(address(nft), a), 1);
        skip(PERIOD - 1);
        assertEq(tenure.weightOf(address(nft), a), 1);
        skip(1);
        assertEq(tenure.weightOf(address(nft), a), 2);
        skip(PERIOD * 3);
        assertEq(tenure.weightOf(address(nft), a), 5);
    }

    function test_TransferResetsTenure() public {
        uint256 a = _mint(alice);
        skip(PERIOD * 4);
        assertEq(tenure.weightOf(address(nft), a), 5);
        vm.prank(alice);
        nft.transferFrom(alice, bob, a);
        assertEq(tenure.weightOf(address(nft), a), 1);
        assertEq(nft.heldSince(a), block.timestamp);
    }

    function test_VaultUsesTenureWithoutChanges() public {
        uint256 a = _mint(alice);
        skip(PERIOD * 3); // alice: weight 4
        uint256 b = _mint(bob); // bob: weight 1
        _deposit(token, 500);
        vault.distribute(address(token));
        _claimAll(address(token));
        assertEq(token.balanceOf(_tba(a)), 400);
        assertEq(token.balanceOf(_tba(b)), 100);
    }

    function test_ZeroPeriodReverts() public {
        vm.expectRevert(TenureWeightStrategy.ZeroPeriod.selector);
        new TenureWeightStrategy(0);
    }
}

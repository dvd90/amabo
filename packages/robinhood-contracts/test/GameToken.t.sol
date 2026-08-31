// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {GameToken} from "../src/GameToken.sol";

/// Optional layer (`--with-token`): a plain ERC-20. No transfer tax, no hooks, no vault wiring.
contract GameTokenTest is Test {
    address alice = makeAddr("alice");
    GameToken token;

    function setUp() public {
        token = new GameToken("Game", "GAME", 1_000_000e18, address(this));
    }

    function test_MintsInitialSupplyToRecipient() public view {
        assertEq(token.totalSupply(), 1_000_000e18);
        assertEq(token.balanceOf(address(this)), 1_000_000e18);
        assertEq(token.name(), "Game");
        assertEq(token.symbol(), "GAME");
    }

    /// Transfers move exactly `amount`; nothing is skimmed anywhere (CLAUDE.md rule 1).
    function testFuzz_TransferHasNoTax(uint256 amount) public {
        amount = bound(amount, 0, token.totalSupply());
        uint256 supplyBefore = token.totalSupply();
        token.transfer(alice, amount);
        assertEq(token.balanceOf(alice), amount);
        assertEq(token.balanceOf(address(this)), supplyBefore - amount);
        assertEq(token.totalSupply(), supplyBefore);
    }
}

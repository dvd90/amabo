// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {RevenueVault} from "../../src/RevenueVault.sol";

/// Hostile ERC-20: every transfer out of the vault tries to re-enter `claim()` and `distribute()`.
contract ReenteringToken is ERC20 {
    RevenueVault public vault;
    uint256 public reentryAttempts;
    uint256 public reentrySuccesses;

    constructor() ERC20("Evil", "EVL") {}

    function setVault(RevenueVault vault_) external {
        vault = vault_;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function transfer(address to, uint256 amount) public override returns (bool) {
        bool ok = super.transfer(to, amount);
        if (msg.sender == address(vault)) {
            uint256[] memory ids = new uint256[](1);
            ids[0] = 1;
            reentryAttempts += 2;
            try vault.claim(address(this), ids) {
                reentrySuccesses++;
            } catch {}
            try vault.distribute(address(this)) {
                reentrySuccesses++;
            } catch {}
        }
        return ok;
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title GameToken
/// @notice Optional plain ERC-20 (`--with-token`). Fixed supply minted once to `recipient`.
///         NO transfer tax, NO hooks, NO vault wiring — revenue enters the vault only via
///         `RevenueVault.depositRevenue()` (CLAUDE.md rule 1).
contract GameToken is ERC20 {
    constructor(string memory name_, string memory symbol_, uint256 supply, address recipient) ERC20(name_, symbol_) {
        _mint(recipient, supply);
    }
}

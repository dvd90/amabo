// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// Transfer-restricted ERC-20 (like a tokenised stock with an allowlist): reverts on transfers to blocked addresses.
contract BlocklistToken is ERC20 {
    error Blocked(address account);

    mapping(address => bool) public blocked;

    constructor() ERC20("Restricted", "RST") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function setBlocked(address account, bool isBlocked) external {
        blocked[account] = isBlocked;
    }

    function _update(address from, address to, uint256 value) internal override {
        if (blocked[to]) revert Blocked(to);
        super._update(from, to, value);
    }
}

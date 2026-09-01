// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";
import {MembershipNFT} from "./MembershipNFT.sol";
import {RevenueVault} from "./RevenueVault.sol";

/// @title Factory
/// @notice EIP-1167 `cloneDeterministic` of a MembershipNFT + RevenueVault pair, wired and owned by
///         the caller in one transaction. Clones are non-upgradeable; the factory holds no powers.
contract Factory {
    error ZeroAddress();

    event ProjectDeployed(address indexed deployer, bytes32 indexed salt, address nft, address vault, address strategy);

    struct Params {
        string name;
        string symbol;
        address treasury;
        uint256 mintPrice;
        uint256 maxSupply;
        address strategy;
    }

    address public immutable nftImpl;
    address public immutable vaultImpl;
    address public immutable registry;
    address public immutable accountImpl;

    constructor(address nftImpl_, address vaultImpl_, address registry_, address accountImpl_) {
        if (nftImpl_ == address(0) || vaultImpl_ == address(0) || registry_ == address(0) || accountImpl_ == address(0))
        {
            revert ZeroAddress();
        }
        nftImpl = nftImpl_;
        vaultImpl = vaultImpl_;
        registry = registry_;
        accountImpl = accountImpl_;
    }

    /// @notice Deploy and initialize an NFT + vault pair. Addresses depend on (msg.sender, salt) only.
    function deploy(bytes32 salt, Params calldata p) external returns (address nft, address vault) {
        (bytes32 nftSalt, bytes32 vaultSalt) = _salts(msg.sender, salt);
        nft = Clones.cloneDeterministic(nftImpl, nftSalt);
        vault = Clones.cloneDeterministic(vaultImpl, vaultSalt);
        MembershipNFT(nft)
            .initialize(p.name, p.symbol, msg.sender, p.treasury, p.mintPrice, p.maxSupply, registry, accountImpl);
        RevenueVault(vault).initialize(msg.sender, nft, p.strategy);
        emit ProjectDeployed(msg.sender, salt, nft, vault, p.strategy);
    }

    /// @notice Addresses `deploy(salt)` will produce when called by `deployer`.
    function predict(address deployer, bytes32 salt) external view returns (address nft, address vault) {
        (bytes32 nftSalt, bytes32 vaultSalt) = _salts(deployer, salt);
        nft = Clones.predictDeterministicAddress(nftImpl, nftSalt);
        vault = Clones.predictDeterministicAddress(vaultImpl, vaultSalt);
    }

    function _salts(address deployer, bytes32 salt) internal pure returns (bytes32 nftSalt, bytes32 vaultSalt) {
        nftSalt = keccak256(abi.encode(deployer, salt, "nft"));
        vaultSalt = keccak256(abi.encode(deployer, salt, "vault"));
    }
}

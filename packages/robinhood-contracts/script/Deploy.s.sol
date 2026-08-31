// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {ERC6551Registry} from "erc6551/ERC6551Registry.sol";
import {ERC6551Account} from "erc6551/examples/simple/ERC6551Account.sol";
import {Constants} from "../src/Constants.sol";
import {Factory} from "../src/Factory.sol";
import {MembershipNFT} from "../src/MembershipNFT.sol";
import {RevenueVault} from "../src/RevenueVault.sol";
import {EqualWeightStrategy} from "../src/strategies/EqualWeightStrategy.sol";

/// @notice Deploys implementations + Factory + EqualWeightStrategy, then one project through the
///         factory, and writes `deployments/<chainId>.json` (read by apps/web).
///
/// Env (all optional): ERC6551_REGISTRY, ERC6551_ACCOUNT_IMPL (override Constants; VERIFY on 4663),
/// PROJECT_NAME, PROJECT_SYMBOL, TREASURY (default: broadcaster), MINT_PRICE (wei), MAX_SUPPLY, SALT.
///
///   forge script script/Deploy.s.sol --rpc-url robinhood --broadcast --verify
contract Deploy is Script {
    error RegistryNotDeployed(address registry);

    uint256 internal constant ANVIL_CHAIN_ID = 31337;

    function run() external {
        address registry = vm.envOr("ERC6551_REGISTRY", Constants.ERC6551_REGISTRY);
        address accountImpl = vm.envOr("ERC6551_ACCOUNT_IMPL", Constants.ERC6551_ACCOUNT_IMPL);

        vm.startBroadcast();
        // Local anvil only: stand up the 6551 pieces ourselves. On a real chain they must exist.
        if (block.chainid == ANVIL_CHAIN_ID) {
            if (registry.code.length == 0) registry = address(new ERC6551Registry());
            if (accountImpl.code.length == 0) accountImpl = address(new ERC6551Account());
        }
        if (registry.code.length == 0) revert RegistryNotDeployed(registry);

        (Factory factory, EqualWeightStrategy strategy) = deployCore(registry, accountImpl);

        (address nft, address vault) = factory.deploy(
            vm.envOr("SALT", bytes32("membership")),
            Factory.Params({
                name: vm.envOr("PROJECT_NAME", string("Membership")),
                symbol: vm.envOr("PROJECT_SYMBOL", string("MBR")),
                treasury: vm.envOr("TREASURY", msg.sender),
                mintPrice: vm.envOr("MINT_PRICE", uint256(0.01 ether)),
                maxSupply: vm.envOr("MAX_SUPPLY", uint256(1000)),
                strategy: address(strategy)
            })
        );
        vm.stopBroadcast();

        _writeDeployment(registry, accountImpl, factory, strategy, nft, vault);
    }

    /// @dev Shared with the integration tests so they exercise the real deploy path.
    function deployCore(address registry, address accountImpl)
        public
        returns (Factory factory, EqualWeightStrategy strategy)
    {
        factory = new Factory(address(new MembershipNFT()), address(new RevenueVault()), registry, accountImpl);
        strategy = new EqualWeightStrategy();
    }

    function _writeDeployment(
        address registry,
        address accountImpl,
        Factory factory,
        EqualWeightStrategy strategy,
        address nft,
        address vault
    ) internal {
        string memory j = "deployment";
        vm.serializeUint(j, "chainId", block.chainid);
        vm.serializeAddress(j, "registry", registry);
        vm.serializeAddress(j, "accountImpl", accountImpl);
        vm.serializeAddress(j, "factory", address(factory));
        vm.serializeAddress(j, "nftImpl", factory.nftImpl());
        vm.serializeAddress(j, "vaultImpl", factory.vaultImpl());
        vm.serializeAddress(j, "equalWeightStrategy", address(strategy));
        vm.serializeAddress(j, "nft", nft);
        string memory out = vm.serializeAddress(j, "vault", vault);

        vm.writeJson(out, string.concat("deployments/", vm.toString(block.chainid), ".json"));
    }
}

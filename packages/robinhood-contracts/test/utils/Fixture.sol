// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";
import {ERC6551Registry} from "erc6551/ERC6551Registry.sol";
import {ERC6551Account} from "erc6551/examples/simple/ERC6551Account.sol";
import {Constants} from "../../src/Constants.sol";
import {MembershipNFT} from "../../src/MembershipNFT.sol";
import {RevenueVault} from "../../src/RevenueVault.sol";
import {MockWeightStrategy} from "../mocks/MockWeightStrategy.sol";
import {MockRewardToken} from "../mocks/MockRewardToken.sol";

/// Shared setup: chain 4663, canonical registry etched, one NFT + vault clone pair, mock strategy.
abstract contract Fixture is Test {
    uint256 constant PRICE = 0.01 ether;
    uint256 constant MAX_SUPPLY = 100;

    address treasury = makeAddr("treasury");
    address accountImpl;
    MembershipNFT nftImpl;
    RevenueVault vaultImpl;
    MembershipNFT nft;
    RevenueVault vault;
    MockWeightStrategy strategy;
    MockRewardToken token;

    function setUp() public virtual {
        vm.chainId(Constants.CHAIN_ID);
        vm.etch(Constants.ERC6551_REGISTRY, address(new ERC6551Registry()).code);
        accountImpl = address(new ERC6551Account());

        nftImpl = new MembershipNFT();
        vaultImpl = new RevenueVault();
        nft = MembershipNFT(Clones.clone(address(nftImpl)));
        nft.initialize(
            "Membership", "MBR", address(this), treasury, PRICE, MAX_SUPPLY, Constants.ERC6551_REGISTRY, accountImpl
        );
        strategy = new MockWeightStrategy();
        vault = RevenueVault(Clones.clone(address(vaultImpl)));
        vault.initialize(address(this), address(nft), address(strategy));
        token = new MockRewardToken();
    }

    function _mint(address who) internal returns (uint256 id) {
        vm.deal(who, who.balance + PRICE);
        vm.prank(who);
        (id,) = nft.mint{value: PRICE}();
    }

    function _deposit(MockRewardToken t, uint256 amount) internal {
        t.mint(address(this), amount);
        t.approve(address(vault), amount);
        vault.depositRevenue(address(t), amount);
    }

    /// Claim every minted token's share of `t` into its TBA.
    function _claimAll(address t) internal {
        uint256 supply = nft.totalSupply();
        uint256[] memory ids = new uint256[](supply);
        for (uint256 i; i < supply; i++) {
            ids[i] = i + 1;
        }
        vault.claim(t, ids);
    }

    function _ids(uint256 id) internal pure returns (uint256[] memory ids) {
        ids = new uint256[](1);
        ids[0] = id;
    }

    function _tba(uint256 id) internal view returns (address) {
        return nft.tokenBoundAccount(id);
    }
}

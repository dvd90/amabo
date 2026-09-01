// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {MembershipNFT} from "../src/MembershipNFT.sol";
import {RevenueVault} from "../src/RevenueVault.sol";
import {StarNFT} from "../src/StarNFT.sol";
import {GameToken} from "../src/GameToken.sol";
import {MockRewardToken} from "../test/mocks/MockRewardToken.sol";

/// @notice Local smoke test against a running node: mint → depositRevenue → distribute, then buy a seat.
///         Reads deployments/<chainId>.json written by Deploy.s.sol. Uses a mock reward token,
///         so run it on anvil only.
contract DryRun is Script {
    function run() external {
        string memory json = vm.readFile(string.concat("deployments/", vm.toString(block.chainid), ".json"));
        MembershipNFT nft = MembershipNFT(vm.parseJsonAddress(json, ".nft"));
        RevenueVault vault = RevenueVault(vm.parseJsonAddress(json, ".vault"));
        StarNFT star = StarNFT(vm.parseJsonAddress(json, ".star"));

        vm.startBroadcast();
        (uint256 tokenId, address tba) = nft.mint{value: nft.mintPrice()}();
        MockRewardToken token = new MockRewardToken();
        token.mint(msg.sender, 1_000e18);
        token.approve(address(vault), 1_000e18);
        vault.depositRevenue(address(token), 1_000e18);
        vault.distribute(address(token));
        uint256[] memory ids = new uint256[](1);
        ids[0] = tokenId;
        vault.claim(address(token), ids);
        (uint256 seat,) = star.mint{value: star.mintPrice()}();
        vm.stopBroadcast();

        console.log("minted tokenId", tokenId, "tba", tba);
        console.log("tba reward balance", token.balanceOf(tba));
        console.log("vault carried dust", vault.distributable(address(token)));
        console.log("bought seat", seat, "unnamed", star.kindOf(seat) == StarNFT.Kind.Unnamed);
        address lumen = vm.parseJsonAddress(json, ".lumen");
        if (lumen != address(0)) {
            console.log("lumen", GameToken(lumen).symbol(), "supply", GameToken(lumen).totalSupply() / 1e18);
        }
    }
}

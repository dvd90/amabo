// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";
import {ERC6551Registry} from "erc6551/ERC6551Registry.sol";
import {ERC6551Account} from "erc6551/examples/simple/ERC6551Account.sol";
import {Constants} from "../src/Constants.sol";
import {MembershipNFT} from "../src/MembershipNFT.sol";

/// Random mint / transfer sequences. Never reverts (invariant.fail_on_revert = true).
contract NFTHandler is Test {
    MembershipNFT public nft;
    address[] public actors;

    constructor(MembershipNFT nft_) {
        nft = nft_;
        for (uint256 i; i < 5; i++) {
            address a = makeAddr(string(abi.encodePacked("actor", i)));
            vm.deal(a, 100 ether);
            actors.push(a);
        }
    }

    function mint(uint256 actorSeed) external {
        if (nft.totalSupply() >= nft.maxSupply()) return;
        address who = actors[actorSeed % actors.length];
        uint256 price = nft.mintPrice();
        vm.prank(who);
        nft.mint{value: price}();
    }

    function transfer(uint256 tokenSeed, uint256 toSeed) external {
        uint256 supply = nft.totalSupply();
        if (supply == 0) return;
        uint256 id = (tokenSeed % supply) + 1;
        address from = nft.ownerOf(id);
        address to = actors[toSeed % actors.length];
        vm.prank(from);
        nft.transferFrom(from, to, id);
    }
}

contract MembershipNFTInvariantTest is Test {
    MembershipNFT nft;
    NFTHandler handler;

    function setUp() public {
        vm.chainId(Constants.CHAIN_ID);
        vm.etch(Constants.ERC6551_REGISTRY, address(new ERC6551Registry()).code);
        address accountImpl = address(new ERC6551Account());

        nft = MembershipNFT(Clones.clone(address(new MembershipNFT())));
        nft.initialize(
            "Membership",
            "MBR",
            address(this),
            makeAddr("treasury"),
            0.01 ether,
            20,
            Constants.ERC6551_REGISTRY,
            accountImpl
        );
        handler = new NFTHandler(nft);
        targetContract(address(handler));
    }

    /// Headline invariant: TBA control follows the NFT.
    function invariant_TBAControlFollowsNFT() public view {
        uint256 supply = nft.totalSupply();
        for (uint256 id = 1; id <= supply; id++) {
            address tba = nft.tokenBoundAccount(id);
            assertGt(tba.code.length, 0, "TBA missing");
            assertEq(ERC6551Account(payable(tba)).owner(), nft.ownerOf(id), "TBA owner != NFT owner");
        }
    }

    function invariant_SupplyNeverExceedsMax() public view {
        assertLe(nft.totalSupply(), nft.maxSupply());
    }
}

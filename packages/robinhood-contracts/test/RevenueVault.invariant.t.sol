// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Fixture} from "./utils/Fixture.sol";
import {MembershipNFT} from "../src/MembershipNFT.sol";
import {RevenueVault} from "../src/RevenueVault.sol";
import {MockRewardToken} from "./mocks/MockRewardToken.sol";
import {MockWeightStrategy} from "./mocks/MockWeightStrategy.sol";

/// Random mints, transfers, weight changes, deposits, distributions and claims over two reward tokens.
contract VaultHandler is Test {
    MembershipNFT nft;
    RevenueVault vault;
    MockWeightStrategy strategy;
    MockRewardToken[] public tokens;
    address[] actors;

    mapping(address => uint256) public deposited; // ghost: Σ depositRevenue per token

    constructor(
        MembershipNFT nft_,
        RevenueVault vault_,
        MockWeightStrategy strategy_,
        MockRewardToken[] memory tokens_
    ) {
        nft = nft_;
        vault = vault_;
        strategy = strategy_;
        tokens = tokens_;
        for (uint256 i; i < 4; i++) {
            address a = makeAddr(string(abi.encodePacked("actor", i)));
            vm.deal(a, 100 ether);
            actors.push(a);
        }
    }

    function mint(uint256 seed) external {
        if (nft.totalSupply() >= nft.maxSupply()) return;
        uint256 price = nft.mintPrice();
        vm.prank(actors[seed % actors.length]);
        nft.mint{value: price}();
    }

    function transfer(uint256 tokenSeed, uint256 toSeed) external {
        uint256 supply = nft.totalSupply();
        if (supply == 0) return;
        uint256 id = (tokenSeed % supply) + 1;
        address from = nft.ownerOf(id);
        vm.prank(from);
        nft.transferFrom(from, actors[toSeed % actors.length], id);
    }

    function setWeight(uint256 idSeed, uint256 weight) external {
        strategy.setWeight(bound(idSeed, 1, nft.maxSupply()), bound(weight, 0, 10));
    }

    function deposit(uint256 tokenSeed, uint256 amount) external {
        MockRewardToken t = tokens[tokenSeed % tokens.length];
        amount = bound(amount, 1, 1e24);
        t.mint(address(this), amount);
        t.approve(address(vault), amount);
        vault.depositRevenue(address(t), amount);
        deposited[address(t)] += amount;
    }

    function distribute(uint256 tokenSeed) external {
        MockRewardToken t = tokens[tokenSeed % tokens.length];
        if (vault.distributable(address(t)) == 0) return;
        vault.distribute(address(t));
    }

    function claim(uint256 tokenSeed, uint256 idSeed) external {
        MockRewardToken t = tokens[tokenSeed % tokens.length];
        uint256 supply = nft.totalSupply();
        if (supply == 0) return;
        uint256[] memory ids = new uint256[](1);
        ids[0] = (idSeed % supply) + 1;
        vault.claim(address(t), ids);
    }
}

contract RevenueVaultInvariantTest is Fixture {
    VaultHandler handler;
    MockRewardToken[] tokens;

    function setUp() public override {
        super.setUp();
        tokens.push(token);
        tokens.push(new MockRewardToken());
        handler = new VaultHandler(nft, vault, strategy, tokens);
        targetContract(address(handler));
    }

    /// Headline invariant: conservation — Σ claimed + Σ claimable + carried == Σ deposited,
    /// and the vault physically holds everything not yet claimed.
    function invariant_Conservation() public view {
        for (uint256 t; t < tokens.length; t++) {
            MockRewardToken tok = tokens[t];
            uint256 carried = vault.distributable(address(tok));
            uint256 supply = nft.totalSupply();
            uint256 claimed;
            uint256 unclaimed;
            for (uint256 id = 1; id <= supply; id++) {
                claimed += tok.balanceOf(nft.tokenBoundAccount(id));
                unclaimed += vault.claimable(address(tok), id);
            }
            assertEq(tok.balanceOf(address(vault)), carried + unclaimed, "vault balance != owed");
            assertEq(claimed + unclaimed + carried, handler.deposited(address(tok)), "value created or lost");
        }
    }
}

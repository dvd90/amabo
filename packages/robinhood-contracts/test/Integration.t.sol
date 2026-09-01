// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC6551Registry} from "erc6551/ERC6551Registry.sol";
import {ERC6551Account} from "erc6551/examples/simple/ERC6551Account.sol";
import {Constants} from "../src/Constants.sol";
import {Factory} from "../src/Factory.sol";
import {MembershipNFT} from "../src/MembershipNFT.sol";
import {RevenueVault} from "../src/RevenueVault.sol";
import {EqualWeightStrategy} from "../src/strategies/EqualWeightStrategy.sol";
import {Deploy} from "../script/Deploy.s.sol";
import {MockRewardToken} from "./mocks/MockRewardToken.sol";

/// End-to-end through the real deploy script: deploy → mint to N wallets → deposit → distribute.
contract IntegrationTest is Test {
    uint256 constant PRICE = 0.01 ether;
    uint256 constant N = 5;

    address creator = makeAddr("creator");
    address treasury = makeAddr("treasury");
    Factory factory;
    EqualWeightStrategy strategy;
    MembershipNFT nft;
    RevenueVault vault;
    MockRewardToken token;
    address[] wallets;

    function setUp() public {
        vm.chainId(Constants.CHAIN_ID);
        vm.etch(Constants.ERC6551_REGISTRY, address(new ERC6551Registry()).code);
        address accountImpl = address(new ERC6551Account());

        (factory, strategy) = new Deploy().deployCore(Constants.ERC6551_REGISTRY, accountImpl);

        vm.prank(creator);
        (address n, address v) = factory.deploy(
            "club",
            Factory.Params({
                name: "Club",
                symbol: "CLB",
                treasury: treasury,
                mintPrice: PRICE,
                maxSupply: 100,
                strategy: address(strategy)
            })
        );
        nft = MembershipNFT(n);
        vault = RevenueVault(v);
        token = new MockRewardToken();

        for (uint256 i; i < N; i++) {
            address w = makeAddr(string(abi.encodePacked("wallet", i)));
            vm.deal(w, PRICE);
            vm.prank(w);
            nft.mint{value: PRICE}();
            wallets.push(w);
        }
    }

    function _claimAll() internal {
        uint256[] memory ids = new uint256[](N);
        for (uint256 i; i < N; i++) {
            ids[i] = i + 1;
        }
        vault.claim(address(token), ids);
    }

    function _deposit(uint256 amount) internal {
        token.mint(address(this), amount);
        token.approve(address(vault), amount);
        vault.depositRevenue(address(token), amount);
    }

    /// Pull `amount` of `token` out of `tokenId`'s TBA as `who` — proves who controls it.
    function _withdrawFromTba(address who, uint256 tokenId, uint256 amount) internal {
        ERC6551Account tba = ERC6551Account(payable(nft.tokenBoundAccount(tokenId)));
        vm.prank(who);
        tba.execute(address(token), 0, abi.encodeCall(token.transfer, (who, amount)), 0);
    }

    function test_E2E_DeployMintDepositDistribute() public {
        assertEq(nft.owner(), creator);
        assertEq(vault.owner(), creator);
        assertEq(treasury.balance, N * PRICE);
        assertEq(address(vault).balance, 0);

        _deposit(1000);
        vm.prank(makeAddr("anyone"));
        vault.distribute(address(token));
        vm.prank(makeAddr("anyone"));
        _claimAll();

        for (uint256 i; i < N; i++) {
            uint256 id = i + 1;
            assertEq(token.balanceOf(nft.tokenBoundAccount(id)), 200);
            _withdrawFromTba(wallets[i], id, 200);
            assertEq(token.balanceOf(wallets[i]), 200);
        }
        assertEq(token.balanceOf(address(vault)), 0);
    }

    function test_TransferMidCycle_NextDistributePaysNewOwner() public {
        address newOwner = makeAddr("newOwner");
        _deposit(500);
        vault.distribute(address(token));
        _claimAll();
        address tba1 = nft.tokenBoundAccount(1);
        assertEq(token.balanceOf(tba1), 100);

        vm.prank(wallets[0]);
        nft.transferFrom(wallets[0], newOwner, 1);

        _deposit(500);
        vault.distribute(address(token));
        _claimAll();
        assertEq(token.balanceOf(tba1), 200);

        // Old owner lost control of the TBA, new owner has it.
        bytes memory pull = abi.encodeCall(token.transfer, (wallets[0], 200));
        vm.prank(wallets[0]);
        vm.expectRevert(bytes("Invalid signer"));
        ERC6551Account(payable(tba1)).execute(address(token), 0, pull, 0);
        _withdrawFromTba(newOwner, 1, 200);
        assertEq(token.balanceOf(newOwner), 200);
    }
}

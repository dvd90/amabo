// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Fixture} from "./utils/Fixture.sol";
import {Constants} from "../src/Constants.sol";
import {Factory} from "../src/Factory.sol";
import {MembershipNFT} from "../src/MembershipNFT.sol";
import {RevenueVault} from "../src/RevenueVault.sol";

contract FactoryTest is Fixture {
    Factory factory;
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");

    function setUp() public override {
        super.setUp();
        factory = new Factory(address(nftImpl), address(vaultImpl), Constants.ERC6551_REGISTRY, accountImpl);
    }

    function _params() internal view returns (Factory.Params memory) {
        return Factory.Params({
            name: "Club",
            symbol: "CLB",
            treasury: treasury,
            mintPrice: PRICE,
            maxSupply: MAX_SUPPLY,
            strategy: address(strategy)
        });
    }

    function _deployAs(address who, bytes32 salt) internal returns (MembershipNFT n, RevenueVault v) {
        vm.prank(who);
        (address na, address va) = factory.deploy(salt, _params());
        return (MembershipNFT(na), RevenueVault(va));
    }

    function test_DeploysWiredClones() public {
        (MembershipNFT n, RevenueVault v) = _deployAs(alice, "s");
        assertGt(address(n).code.length, 0);
        assertGt(address(v).code.length, 0);
        assertEq(address(v.nft()), address(n));
        assertEq(address(v.strategy()), address(strategy));
        assertEq(address(n.registry()), Constants.ERC6551_REGISTRY);
        assertEq(n.accountImpl(), accountImpl);
        assertEq(n.maxSupply(), MAX_SUPPLY);
        assertEq(n.mintPrice(), PRICE);
        assertEq(n.treasury(), treasury);
        assertEq(n.name(), "Club");
    }

    function testFuzz_PredictMatchesDeployed(address deployer, bytes32 salt) public {
        vm.assume(deployer != address(0) && deployer.code.length == 0);
        (address pn, address pv) = factory.predict(deployer, salt);
        (MembershipNFT n, RevenueVault v) = _deployAs(deployer, salt);
        assertEq(address(n), pn);
        assertEq(address(v), pv);
    }

    function test_SameDeployerSameSaltReverts() public {
        _deployAs(alice, "s");
        vm.prank(alice);
        vm.expectRevert();
        factory.deploy("s", _params());
    }

    function test_SameSaltDifferentDeployersDoNotCollide() public {
        (MembershipNFT a,) = _deployAs(alice, "s");
        (MembershipNFT b,) = _deployAs(bob, "s");
        assertTrue(address(a) != address(b));
    }

    function test_OwnershipTransfersToCaller() public {
        (MembershipNFT n, RevenueVault v) = _deployAs(alice, "s");
        assertEq(n.owner(), alice);
        assertEq(v.owner(), alice);
        assertEq(n.pendingOwner(), address(0));
    }

    function test_ClonesCannotBeReinitialized() public {
        (MembershipNFT n, RevenueVault v) = _deployAs(alice, "s");
        vm.expectRevert();
        n.initialize("x", "x", bob, treasury, 0, 1, Constants.ERC6551_REGISTRY, accountImpl);
        vm.expectRevert();
        v.initialize(bob, address(n), address(strategy));
    }

    function test_ImplementationsCannotBeInitialized() public {
        vm.expectRevert();
        nftImpl.initialize("x", "x", bob, treasury, 0, 1, Constants.ERC6551_REGISTRY, accountImpl);
        vm.expectRevert();
        vaultImpl.initialize(bob, address(nft), address(strategy));
    }

    function test_TwoDeploysAreStateIsolated() public {
        (MembershipNFT a, RevenueVault va) = _deployAs(alice, "a");
        (MembershipNFT b, RevenueVault vb) = _deployAs(bob, "b");

        vm.deal(alice, PRICE);
        vm.prank(alice);
        a.mint{value: PRICE}();
        assertEq(a.totalSupply(), 1);
        assertEq(b.totalSupply(), 0);

        token.mint(address(this), 100);
        token.approve(address(va), 100);
        va.depositRevenue(address(token), 100);
        assertEq(va.distributable(address(token)), 100);
        assertEq(vb.distributable(address(token)), 0);

        va.distribute(address(token));
        assertEq(va.claimable(address(token), 1), 100);
        assertEq(vb.claimable(address(token), 1), 0);
    }

    function test_MintProceedsNeverReachFactoryOrVault() public {
        (MembershipNFT n, RevenueVault v) = _deployAs(alice, "s");
        vm.deal(bob, PRICE);
        vm.prank(bob);
        n.mint{value: PRICE}();
        assertEq(address(v).balance, 0);
        assertEq(address(factory).balance, 0);
        assertEq(treasury.balance, PRICE);
    }

    function test_EmitsProjectDeployed() public {
        (address pn, address pv) = factory.predict(alice, "s");
        vm.expectEmit(true, true, true, true);
        emit Factory.ProjectDeployed(alice, "s", pn, pv, address(strategy));
        _deployAs(alice, "s");
    }
}

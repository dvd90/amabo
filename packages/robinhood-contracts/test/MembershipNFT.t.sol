// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";
import {ERC6551Registry} from "erc6551/ERC6551Registry.sol";
import {IERC6551Registry} from "erc6551/interfaces/IERC6551Registry.sol";
import {ERC6551Account} from "erc6551/examples/simple/ERC6551Account.sol";
import {Constants} from "../src/Constants.sol";
import {MembershipNFT} from "../src/MembershipNFT.sol";

contract MembershipNFTTest is Test {
    uint256 constant PRICE = 0.01 ether;
    uint256 constant MAX_SUPPLY = 3;

    address treasury = makeAddr("treasury");
    address vault = makeAddr("vault"); // stand-in until RevenueVault exists (Phase 2)
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");

    MembershipNFT nft;
    address accountImpl;

    function setUp() public {
        vm.chainId(Constants.CHAIN_ID);
        vm.etch(Constants.ERC6551_REGISTRY, address(new ERC6551Registry()).code);
        accountImpl = address(new ERC6551Account());

        nft = MembershipNFT(Clones.clone(address(new MembershipNFT())));
        nft.initialize(
            "Membership", "MBR", address(this), treasury, PRICE, MAX_SUPPLY, Constants.ERC6551_REGISTRY, accountImpl
        );
        vm.deal(alice, 10 ether);
        vm.deal(bob, 10 ether);
    }

    function _mint(address who) internal returns (uint256 id, address tba) {
        vm.prank(who);
        return nft.mint{value: PRICE}();
    }

    function test_MintsSequentialIds() public {
        (uint256 a,) = _mint(alice);
        (uint256 b,) = _mint(bob);
        (uint256 c,) = _mint(alice);
        assertEq(a, 1);
        assertEq(b, 2);
        assertEq(c, 3);
        assertEq(nft.ownerOf(2), bob);
        assertEq(nft.totalSupply(), 3);
    }

    function test_RespectsMaxSupply() public {
        for (uint256 i; i < MAX_SUPPLY; i++) {
            _mint(alice);
        }
        vm.prank(alice);
        vm.expectRevert(MembershipNFT.MaxSupplyReached.selector);
        nft.mint{value: PRICE}();
    }

    function test_EnforcesMintPrice() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(MembershipNFT.InsufficientPayment.selector, PRICE - 1, PRICE));
        nft.mint{value: PRICE - 1}();
    }

    function test_RefundsExcessEth() public {
        uint256 before = alice.balance;
        vm.prank(alice);
        nft.mint{value: PRICE * 3}();
        assertEq(before - alice.balance, PRICE);
    }

    function test_MintCreatesTBAAtCanonicalRegistry() public {
        (uint256 id, address tba) = _mint(alice);
        assertGt(tba.code.length, 0, "TBA not deployed");
        address expected = IERC6551Registry(Constants.ERC6551_REGISTRY)
            .account(accountImpl, bytes32(0), Constants.CHAIN_ID, address(nft), id);
        assertEq(tba, expected);
        assertEq(ERC6551Account(payable(tba)).owner(), alice);
    }

    function testFuzz_ComputedAddressMatchesRegistry(uint256 tokenId) public view {
        address expected = IERC6551Registry(Constants.ERC6551_REGISTRY)
            .account(accountImpl, bytes32(0), Constants.CHAIN_ID, address(nft), tokenId);
        assertEq(nft.tokenBoundAccount(tokenId), expected);
    }

    /// CLAUDE.md rule 1: mint proceeds go to treasury, never to a vault.
    function test_MintProceedsLandAtTreasury_VaultUntouched() public {
        uint256 vaultBefore = vault.balance;
        vm.prank(alice);
        nft.mint{value: PRICE * 2}();
        assertEq(treasury.balance, PRICE);
        assertEq(vault.balance, vaultBefore);
        assertEq(address(nft).balance, 0);
    }

    function test_EmitsMinted() public {
        address expectedTba = nft.tokenBoundAccount(1);
        vm.expectEmit(true, true, true, true);
        emit MembershipNFT.Minted(1, alice, expectedTba);
        _mint(alice);
    }

    function test_CannotReinitialize() public {
        vm.expectRevert();
        nft.initialize("x", "x", address(this), treasury, PRICE, MAX_SUPPLY, Constants.ERC6551_REGISTRY, accountImpl);
    }

    function test_OnlyOwnerSetsTreasuryAndPrice() public {
        vm.prank(alice);
        vm.expectRevert();
        nft.setTreasury(alice);
        vm.prank(alice);
        vm.expectRevert();
        nft.setMintPrice(1);

        nft.setTreasury(bob);
        nft.setMintPrice(1 wei);
        assertEq(nft.treasury(), bob);
        assertEq(nft.mintPrice(), 1 wei);
    }

    function test_HeldSinceTracksCurrentOwner() public {
        (uint256 id,) = _mint(alice);
        uint256 t0 = block.timestamp;
        assertEq(nft.heldSince(id), t0);
        skip(100);
        assertEq(nft.heldSince(id), t0);
        vm.prank(alice);
        nft.transferFrom(alice, bob, id);
        assertEq(nft.heldSince(id), t0 + 100);
    }

    function test_InitializeRejectsNonContracts() public {
        MembershipNFT fresh = MembershipNFT(Clones.clone(address(new MembershipNFT())));
        vm.expectRevert(abi.encodeWithSelector(MembershipNFT.NotAContract.selector, alice));
        fresh.initialize("x", "x", address(this), treasury, PRICE, MAX_SUPPLY, alice, accountImpl);
        vm.expectRevert(abi.encodeWithSelector(MembershipNFT.NotAContract.selector, alice));
        fresh.initialize("x", "x", address(this), treasury, PRICE, MAX_SUPPLY, Constants.ERC6551_REGISTRY, alice);
    }

    /// A treasury that cannot receive ETH would brick mint(); reject it up front.
    function test_TreasuryMustAcceptEth() public {
        address nonPayable = address(new MembershipNFT()); // no receive/fallback
        vm.expectRevert(abi.encodeWithSelector(MembershipNFT.TreasuryNotPayable.selector, nonPayable));
        nft.setTreasury(nonPayable);

        MembershipNFT fresh = MembershipNFT(Clones.clone(address(new MembershipNFT())));
        vm.expectRevert(abi.encodeWithSelector(MembershipNFT.TreasuryNotPayable.selector, nonPayable));
        fresh.initialize(
            "x", "x", address(this), nonPayable, PRICE, MAX_SUPPLY, Constants.ERC6551_REGISTRY, accountImpl
        );

        nft.setTreasury(bob); // EOA is fine
        assertEq(nft.treasury(), bob);
    }
}

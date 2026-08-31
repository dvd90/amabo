// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";
import {IERC721Errors} from "@openzeppelin/contracts/interfaces/draft-IERC6093.sol";
import {ERC6551Registry} from "erc6551/ERC6551Registry.sol";
import {ERC6551Account} from "erc6551/examples/simple/ERC6551Account.sol";
import {Constants} from "../src/Constants.sol";
import {MembershipNFT} from "../src/MembershipNFT.sol";
import {StarNFT} from "../src/StarNFT.sol";

/// STORY.md §7½ / ARCHITECTURE.md §13: two kinds of star. Unnamed = bought seat (open mint,
/// capped). Inscribed = earned, struck only with an API-signed voucher; one soul, one star.
/// Soulbound unless rehomed through the double-confirmed ceremony.
contract StarNFTTest is Test {
    uint256 constant SEAT_PRICE = 0.01 ether;
    uint256 constant INSCRIBE_PRICE = 0.002 ether;
    uint256 constant MAX_SEATS = 2;

    address treasury = makeAddr("treasury");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address signer;
    uint256 signerPk;
    address stranger;
    uint256 strangerPk;

    StarNFT nft;
    address accountImpl;

    bytes32 constant SOUL_A = keccak256("creature-a");
    bytes32 constant SOUL_B = keccak256("creature-b");
    bytes32 constant META = keccak256("metadata");

    function setUp() public {
        vm.chainId(Constants.CHAIN_ID);
        vm.etch(Constants.ERC6551_REGISTRY, address(new ERC6551Registry()).code);
        accountImpl = address(new ERC6551Account());
        (signer, signerPk) = makeAddrAndKey("api-signer");
        (stranger, strangerPk) = makeAddrAndKey("stranger");

        nft = StarNFT(Clones.clone(address(new StarNFT())));
        nft.initialize(
            "Star",
            "STAR",
            address(this),
            treasury,
            SEAT_PRICE,
            MAX_SEATS,
            Constants.ERC6551_REGISTRY,
            accountImpl,
            signer,
            INSCRIBE_PRICE
        );
        nft.setBaseURI("https://www.theamarium.com/sky/");
        vm.deal(alice, 10 ether);
        vm.deal(bob, 10 ether);
    }

    // ---- helpers -------------------------------------------------------------------------

    function _voucher(uint256 tokenId, address to, bytes32 soul, uint256 pk)
        internal
        view
        returns (StarNFT.Inscription memory v, bytes memory sig)
    {
        v = StarNFT.Inscription({
            tokenId: tokenId, to: to, creatureId: soul, metadataHash: META, deadline: block.timestamp + 1 hours
        });
        (uint8 vv, bytes32 r, bytes32 s) = vm.sign(pk, nft.hashInscription(v));
        sig = abi.encodePacked(r, s, vv);
    }

    function _seat(address who) internal returns (uint256 id) {
        vm.prank(who);
        (id,) = nft.mint{value: SEAT_PRICE}();
    }

    function _inscribe(address who, bytes32 soul) internal returns (uint256 id) {
        (StarNFT.Inscription memory v, bytes memory sig) = _voucher(0, who, soul, signerPk);
        vm.prank(who);
        (id,) = nft.inscribe{value: INSCRIBE_PRICE}(v, sig);
    }

    // ---- unnamed stars (bought seats) ----------------------------------------------------

    function test_SeatMintIsUnnamed() public {
        uint256 id = _seat(alice);
        assertEq(uint8(nft.kindOf(id)), uint8(StarNFT.Kind.Unnamed));
        assertEq(nft.creatureOf(id), bytes32(0));
        assertEq(nft.ownerOf(id), alice);
    }

    function test_SeatsAreCappedButInscriptionsAreNot() public {
        _seat(alice);
        _seat(bob);
        vm.prank(alice);
        vm.expectRevert(MembershipNFT.MaxSupplyReached.selector);
        nft.mint{value: SEAT_PRICE}();
        // Remembrance is never lost for want of a seat.
        uint256 id = _inscribe(alice, SOUL_A);
        assertEq(id, 3);
    }

    function test_InscriptionsDoNotEatSeats() public {
        _inscribe(alice, SOUL_A);
        _inscribe(bob, SOUL_B);
        assertEq(_seat(alice), 3);
        assertEq(_seat(bob), 4);
    }

    // ---- inscribed stars (earned) --------------------------------------------------------

    function test_InscribeStrikesNewStar() public {
        uint256 treasuryBefore = treasury.balance;
        (StarNFT.Inscription memory v, bytes memory sig) = _voucher(0, alice, SOUL_A, signerPk);
        vm.prank(alice);
        (uint256 id, address tba) = nft.inscribe{value: INSCRIBE_PRICE}(v, sig);

        assertEq(id, 1);
        assertEq(nft.ownerOf(id), alice);
        assertEq(uint8(nft.kindOf(id)), uint8(StarNFT.Kind.Inscribed));
        assertEq(nft.creatureOf(id), SOUL_A);
        assertEq(nft.starOf(SOUL_A), id);
        assertEq(nft.metadataHashOf(id), META);
        assertEq(tba, nft.tokenBoundAccount(id));
        assertGt(tba.code.length, 0, "TBA not deployed");
        assertEq(treasury.balance - treasuryBefore, INSCRIBE_PRICE);
    }

    function test_InscribeRefundsExcess() public {
        (StarNFT.Inscription memory v, bytes memory sig) = _voucher(0, alice, SOUL_A, signerPk);
        uint256 before = alice.balance;
        vm.prank(alice);
        nft.inscribe{value: INSCRIBE_PRICE * 4}(v, sig);
        assertEq(before - alice.balance, INSCRIBE_PRICE);
    }

    function test_InscribeCanBeFree() public {
        nft.setInscribePrice(0);
        (StarNFT.Inscription memory v, bytes memory sig) = _voucher(0, alice, SOUL_A, signerPk);
        vm.prank(alice);
        nft.inscribe(v, sig);
        assertEq(nft.starOf(SOUL_A), 1);
    }

    function test_InscribeRejectsUnknownSigner() public {
        (StarNFT.Inscription memory v, bytes memory sig) = _voucher(0, alice, SOUL_A, strangerPk);
        vm.prank(alice);
        vm.expectRevert(StarNFT.InvalidVoucher.selector);
        nft.inscribe{value: INSCRIBE_PRICE}(v, sig);
    }

    function test_InscribeRejectsExpiredVoucher() public {
        (StarNFT.Inscription memory v, bytes memory sig) = _voucher(0, alice, SOUL_A, signerPk);
        vm.warp(v.deadline + 1);
        vm.prank(alice);
        vm.expectRevert(StarNFT.VoucherExpired.selector);
        nft.inscribe{value: INSCRIBE_PRICE}(v, sig);
    }

    function test_InscribeRejectsAnotherWalletsVoucher() public {
        (StarNFT.Inscription memory v, bytes memory sig) = _voucher(0, alice, SOUL_A, signerPk);
        vm.prank(bob);
        vm.expectRevert(StarNFT.InvalidVoucher.selector);
        nft.inscribe{value: INSCRIBE_PRICE}(v, sig);
    }

    function test_InscribeRejectsTamperedVoucher() public {
        (StarNFT.Inscription memory v, bytes memory sig) = _voucher(0, alice, SOUL_A, signerPk);
        v.creatureId = SOUL_B;
        vm.prank(alice);
        vm.expectRevert(StarNFT.InvalidVoucher.selector);
        nft.inscribe{value: INSCRIBE_PRICE}(v, sig);
    }

    function test_OneSoulOneStar() public {
        _inscribe(alice, SOUL_A);
        (StarNFT.Inscription memory v, bytes memory sig) = _voucher(0, bob, SOUL_A, signerPk);
        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(StarNFT.AlreadyInscribed.selector, SOUL_A, 1));
        nft.inscribe{value: INSCRIBE_PRICE}(v, sig);
    }

    function test_InscribeRejectsEmptySoul() public {
        (StarNFT.Inscription memory v, bytes memory sig) = _voucher(0, alice, bytes32(0), signerPk);
        vm.prank(alice);
        vm.expectRevert(StarNFT.InvalidVoucher.selector);
        nft.inscribe{value: INSCRIBE_PRICE}(v, sig);
    }

    function test_OnlyOwnerRotatesSigner() public {
        vm.prank(alice);
        vm.expectRevert();
        nft.setSigner(stranger);
        nft.setSigner(stranger);
        (StarNFT.Inscription memory v, bytes memory sig) = _voucher(0, alice, SOUL_A, strangerPk);
        vm.prank(alice);
        nft.inscribe{value: INSCRIBE_PRICE}(v, sig);
        assertEq(nft.starOf(SOUL_A), 1);
    }

    // ---- naming an unnamed star ----------------------------------------------------------

    function test_NameUnnamedStarFlipsItOnce() public {
        uint256 id = _seat(alice);
        (StarNFT.Inscription memory v, bytes memory sig) = _voucher(id, alice, SOUL_A, signerPk);
        vm.prank(alice);
        (uint256 named, address tba) = nft.inscribe(v, sig);

        assertEq(named, id);
        assertEq(nft.totalSupply(), 1, "naming must not mint");
        assertEq(uint8(nft.kindOf(id)), uint8(StarNFT.Kind.Inscribed));
        assertEq(nft.creatureOf(id), SOUL_A);
        assertEq(nft.starOf(SOUL_A), id);
        assertEq(tba, nft.tokenBoundAccount(id));
    }

    function test_NamingIsFreeAndRefundsAnyEth() public {
        uint256 id = _seat(alice);
        uint256 before = alice.balance;
        (StarNFT.Inscription memory v, bytes memory sig) = _voucher(id, alice, SOUL_A, signerPk);
        vm.prank(alice);
        nft.inscribe{value: 1 ether}(v, sig);
        assertEq(alice.balance, before);
    }

    function test_NameRequiresHolder() public {
        uint256 id = _seat(alice);
        (StarNFT.Inscription memory v, bytes memory sig) = _voucher(id, bob, SOUL_A, signerPk);
        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(StarNFT.NotHolder.selector, id, bob));
        nft.inscribe(v, sig);
    }

    function test_NamedStarIsNeverUnnamedAgain() public {
        uint256 id = _inscribe(alice, SOUL_A);
        (StarNFT.Inscription memory v, bytes memory sig) = _voucher(id, alice, SOUL_B, signerPk);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(StarNFT.NotUnnamed.selector, id));
        nft.inscribe(v, sig);
    }

    // ---- soulbound + the rehome ceremony -------------------------------------------------

    function test_StarsAreSoulbound() public {
        uint256 id = _inscribe(alice, SOUL_A);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(StarNFT.Soulbound.selector, id));
        nft.transferFrom(alice, bob, id);
    }

    function test_OfferAloneDoesNotMoveTheStar() public {
        uint256 id = _inscribe(alice, SOUL_A);
        vm.prank(alice);
        nft.offerRehome(id, bob);
        assertEq(nft.rehomeOffer(id), bob);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(StarNFT.Soulbound.selector, id));
        nft.transferFrom(alice, bob, id);
        assertEq(nft.ownerOf(id), alice);
    }

    function test_RehomeIsDoubleConfirmed() public {
        uint256 id = _inscribe(alice, SOUL_A);
        vm.prank(alice);
        nft.offerRehome(id, bob);
        vm.prank(bob);
        nft.acceptRehome(id);
        assertEq(nft.ownerOf(id), bob);
        assertEq(nft.rehomeOffer(id), address(0), "offer must clear");
        assertEq(nft.creatureOf(id), SOUL_A, "the soul travels with the star");
    }

    function test_OnlyTheOfferedMayAccept() public {
        uint256 id = _inscribe(alice, SOUL_A);
        vm.prank(alice);
        nft.offerRehome(id, bob);
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(StarNFT.NotOffered.selector, id, stranger));
        nft.acceptRehome(id);
    }

    function test_OnlyHolderMayOffer() public {
        uint256 id = _inscribe(alice, SOUL_A);
        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(StarNFT.NotHolder.selector, id, bob));
        nft.offerRehome(id, bob);
    }

    function test_HolderMayRevokeOffer() public {
        uint256 id = _inscribe(alice, SOUL_A);
        vm.prank(alice);
        nft.offerRehome(id, bob);
        vm.prank(alice);
        nft.revokeRehome(id);
        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(StarNFT.NotOffered.selector, id, bob));
        nft.acceptRehome(id);
    }

    function test_OfferDiesWithTheHolder() public {
        // An offer made by a previous holder must not survive the rehome.
        uint256 id = _inscribe(alice, SOUL_A);
        vm.prank(alice);
        nft.offerRehome(id, bob);
        vm.prank(bob);
        nft.acceptRehome(id);
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(StarNFT.NotOffered.selector, id, stranger));
        nft.acceptRehome(id);
    }

    // ---- metadata ------------------------------------------------------------------------

    function test_TokenURIPointsAtTheSky() public {
        uint256 id = _inscribe(alice, SOUL_A);
        assertEq(nft.tokenURI(id), "https://www.theamarium.com/sky/1");
    }

    function test_TokenURIRevertsForUnstruckStar() public {
        vm.expectRevert(abi.encodeWithSelector(IERC721Errors.ERC721NonexistentToken.selector, 9));
        nft.tokenURI(9);
    }

    function testFuzz_KindIsUnnamedForSeatsAndInscribedForSouls(bytes32 soul) public {
        vm.assume(soul != bytes32(0));
        uint256 seat = _seat(alice);
        uint256 star = _inscribe(bob, soul);
        assertEq(uint8(nft.kindOf(seat)), uint8(StarNFT.Kind.Unnamed));
        assertEq(uint8(nft.kindOf(star)), uint8(StarNFT.Kind.Inscribed));
        assertEq(nft.starOf(soul), star);
    }
}

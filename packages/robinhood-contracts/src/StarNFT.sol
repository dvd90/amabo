// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {EIP712Upgradeable} from "@openzeppelin/contracts-upgradeable/utils/cryptography/EIP712Upgradeable.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {MembershipNFT} from "./MembershipNFT.sol";

/// @title StarNFT — the stars of the Sky (STORY.md §7½, ARCHITECTURE.md §13)
/// @notice Two kinds of star. **Unnamed** = a bought seat: open `mint()`, capped by `maxSupply`.
///         **Inscribed** = earned: struck only with an EIP-712 voucher the game's API signs for a
///         creature that ascended; a voucher may also *name* an unnamed star the caller holds.
///         One soul, one star. Soulbound unless rehomed through the double-confirmed ceremony.
///         Nothing here is read by the game and nothing here gates play.
/// @dev Deployed as an EIP-1167 clone; `initialize()` replaces the constructor. Proceeds go to
///      `treasury`, never to a vault (CLAUDE.md rule 1).
contract StarNFT is MembershipNFT, EIP712Upgradeable {
    enum Kind {
        Unnamed,
        Inscribed
    }

    /// @param tokenId 0 = strike a new star; otherwise the unnamed star the caller holds to name.
    /// @param to The wallet the voucher is bound to (must be the caller).
    /// @param creatureId The ascended creature; one soul, one star.
    /// @param metadataHash Hash of the star's off-chain record (soulmark, name, lineage, dates).
    struct Inscription {
        uint256 tokenId;
        address to;
        bytes32 creatureId;
        bytes32 metadataHash;
        uint256 deadline;
    }

    bytes32 internal constant INSCRIPTION_TYPEHASH =
        keccak256("Inscription(uint256 tokenId,address to,bytes32 creatureId,bytes32 metadataHash,uint256 deadline)");

    error InvalidVoucher();
    error VoucherExpired();
    error AlreadyInscribed(bytes32 creatureId, uint256 tokenId);
    error NotUnnamed(uint256 tokenId);
    error NotHolder(uint256 tokenId, address account);
    error NotOffered(uint256 tokenId, address account);
    error Soulbound(uint256 tokenId);

    event Inscribed(uint256 indexed tokenId, bytes32 indexed creatureId, address indexed to, bytes32 metadataHash);
    event RehomeOffered(uint256 indexed tokenId, address indexed from, address indexed to);
    event RehomeRevoked(uint256 indexed tokenId);
    event Rehomed(uint256 indexed tokenId, address indexed from, address indexed to);
    event SignerUpdated(address indexed signer);
    event InscribePriceUpdated(uint256 inscribePrice);
    event BaseURIUpdated(string baseURI);

    /// @notice The game API's voucher signer.
    address public signer;
    /// @notice Price to strike an inscribed star (may be 0). Seats use `mintPrice`.
    uint256 public inscribePrice;
    /// @notice Seats sold so far; only seats count against `maxSupply`. Remembrance is never capped.
    uint256 public seatSupply;
    string public baseURI;
    mapping(uint256 tokenId => Kind) public kindOf;
    mapping(uint256 tokenId => bytes32) public creatureOf;
    mapping(bytes32 creatureId => uint256) public starOf;
    mapping(uint256 tokenId => bytes32) public metadataHashOf;
    /// @notice Pending rehome: the wallet the holder offered `tokenId` to.
    mapping(uint256 tokenId => address) public rehomeOffer;
    bool private _rehoming;

    function initialize(
        string memory name_,
        string memory symbol_,
        address owner_,
        address treasury_,
        uint256 seatPrice_,
        uint256 maxSeats_,
        address registry_,
        address accountImpl_,
        address signer_,
        uint256 inscribePrice_
    ) external initializer {
        __MembershipNFT_init(name_, symbol_, owner_, treasury_, seatPrice_, maxSeats_, registry_, accountImpl_);
        __EIP712_init(name_, "1");
        if (signer_ == address(0)) revert ZeroAddress();
        signer = signer_;
        inscribePrice = inscribePrice_;
    }

    // ---- unnamed stars ---------------------------------------------------------------------

    /// @notice Buy a seat in the Sky: an unnamed star. Only seats count against `maxSupply`.
    function mint() external payable override returns (uint256 tokenId, address tba) {
        if (seatSupply >= maxSupply) revert MaxSupplyReached();
        seatSupply++;
        return _mintTo(msg.sender, mintPrice);
    }

    // ---- inscribed stars -------------------------------------------------------------------

    /// @notice Strike a new inscribed star (`v.tokenId == 0`, charges `inscribePrice`) or name an
    ///         unnamed star you hold (`v.tokenId` set, free). Either way the voucher must be signed
    ///         by `signer`, bound to the caller, unexpired, and for a soul not yet in the Sky.
    function inscribe(Inscription calldata v, bytes calldata sig)
        external
        payable
        returns (uint256 tokenId, address tba)
    {
        if (block.timestamp > v.deadline) revert VoucherExpired();
        if (v.to != msg.sender || v.creatureId == bytes32(0)) revert InvalidVoucher();
        if (ECDSA.recover(hashInscription(v), sig) != signer) revert InvalidVoucher();
        uint256 taken = starOf[v.creatureId];
        if (taken != 0) revert AlreadyInscribed(v.creatureId, taken);

        if (v.tokenId == 0) {
            (tokenId, tba) = _mintTo(msg.sender, inscribePrice);
        } else {
            tokenId = v.tokenId;
            if (ownerOf(tokenId) != msg.sender) revert NotHolder(tokenId, msg.sender);
            if (kindOf[tokenId] != Kind.Unnamed) revert NotUnnamed(tokenId);
            tba = tokenBoundAccount(tokenId);
            if (msg.value > 0) _sendEth(msg.sender, msg.value); // naming is free; never trap ETH
        }

        kindOf[tokenId] = Kind.Inscribed;
        creatureOf[tokenId] = v.creatureId;
        starOf[v.creatureId] = tokenId;
        metadataHashOf[tokenId] = v.metadataHash;
        emit Inscribed(tokenId, v.creatureId, msg.sender, v.metadataHash);
    }

    /// @notice EIP-712 digest the API signs. Exposed so signers and tests agree byte for byte.
    function hashInscription(Inscription calldata v) public view returns (bytes32) {
        return _hashTypedDataV4(
            keccak256(abi.encode(INSCRIPTION_TYPEHASH, v.tokenId, v.to, v.creatureId, v.metadataHash, v.deadline))
        );
    }

    // ---- the rehome ceremony (the only way a star moves) -----------------------------------

    function offerRehome(uint256 tokenId, address to) external {
        if (ownerOf(tokenId) != msg.sender) revert NotHolder(tokenId, msg.sender);
        if (to == address(0)) revert ZeroAddress();
        rehomeOffer[tokenId] = to;
        emit RehomeOffered(tokenId, msg.sender, to);
    }

    function revokeRehome(uint256 tokenId) external {
        if (ownerOf(tokenId) != msg.sender) revert NotHolder(tokenId, msg.sender);
        delete rehomeOffer[tokenId];
        emit RehomeRevoked(tokenId);
    }

    function acceptRehome(uint256 tokenId) external {
        if (rehomeOffer[tokenId] != msg.sender) revert NotOffered(tokenId, msg.sender);
        address from = ownerOf(tokenId);
        delete rehomeOffer[tokenId];
        _rehoming = true;
        _transfer(from, msg.sender, tokenId);
        _rehoming = false;
        emit Rehomed(tokenId, from, msg.sender);
    }

    // ---- admin ---------------------------------------------------------------------------------

    function setSigner(address signer_) external onlyOwner {
        if (signer_ == address(0)) revert ZeroAddress();
        signer = signer_;
        emit SignerUpdated(signer_);
    }

    function setInscribePrice(uint256 inscribePrice_) external onlyOwner {
        inscribePrice = inscribePrice_;
        emit InscribePriceUpdated(inscribePrice_);
    }

    function setBaseURI(string calldata baseURI_) external onlyOwner {
        baseURI = baseURI_;
        emit BaseURIUpdated(baseURI_);
    }

    // ---- internals -------------------------------------------------------------------------

    /// @dev Mints and burns pass; holder-to-holder moves only inside `acceptRehome`.
    function _update(address to, uint256 tokenId, address auth) internal override returns (address from) {
        from = _ownerOf(tokenId);
        if (from != address(0) && to != address(0) && !_rehoming) revert Soulbound(tokenId);
        return super._update(to, tokenId, auth);
    }

    function _baseURI() internal view override returns (string memory) {
        return baseURI;
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import {Ownable2StepUpgradeable} from "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";
import {IERC6551Registry} from "erc6551/interfaces/IERC6551Registry.sol";

/// @title MembershipNFT
/// @notice ERC-721 where every token owns an ERC-6551 token-bound account (TBA).
/// @dev Deployed as an EIP-1167 clone; `initialize()` replaces the constructor.
///      Mint proceeds go to `treasury` and NEVER to a vault (CLAUDE.md rule 1).
contract MembershipNFT is ERC721Upgradeable, Ownable2StepUpgradeable {
    bytes32 internal constant TBA_SALT = bytes32(0);

    error MaxSupplyReached();
    error InsufficientPayment(uint256 sent, uint256 required);
    error ZeroAddress();
    error NotAContract(address account);
    error TreasuryNotPayable(address treasury);
    error EthTransferFailed();

    event Minted(uint256 indexed tokenId, address indexed to, address indexed tba);
    event TreasuryUpdated(address indexed treasury);
    event MintPriceUpdated(uint256 mintPrice);

    address public treasury;
    uint256 public mintPrice;
    uint256 public maxSupply;
    IERC6551Registry public registry;
    address public accountImpl;
    /// @dev Tokens are never burned, so ids are exactly 1..totalSupply.
    uint256 public totalSupply;
    /// @notice Timestamp the current owner acquired `tokenId` (mint or last transfer). Strategy input.
    mapping(uint256 tokenId => uint256) public heldSince;

    constructor() {
        _disableInitializers();
    }

    function initialize(
        string memory name_,
        string memory symbol_,
        address owner_,
        address treasury_,
        uint256 mintPrice_,
        uint256 maxSupply_,
        address registry_,
        address accountImpl_
    ) external initializer {
        _requireContract(registry_);
        _requireContract(accountImpl_);
        _requirePayable(treasury_);
        __ERC721_init(name_, symbol_);
        __Ownable_init(owner_);
        __Ownable2Step_init();
        treasury = treasury_;
        mintPrice = mintPrice_;
        maxSupply = maxSupply_;
        registry = IERC6551Registry(registry_);
        accountImpl = accountImpl_;
    }

    /// @notice Mint the next token to the caller and deploy its TBA. Excess ETH is refunded.
    function mint() external payable returns (uint256 tokenId, address tba) {
        uint256 price = mintPrice;
        if (msg.value < price) revert InsufficientPayment(msg.value, price);
        if (totalSupply >= maxSupply) revert MaxSupplyReached();

        tokenId = ++totalSupply;
        _safeMint(msg.sender, tokenId);
        tba = registry.createAccount(accountImpl, TBA_SALT, block.chainid, address(this), tokenId);
        emit Minted(tokenId, msg.sender, tba);

        // Proceeds to treasury only. Do not route these into RevenueVault (rule 1).
        if (price > 0) _sendEth(treasury, price);
        if (msg.value > price) _sendEth(msg.sender, msg.value - price);
    }

    /// @notice Deterministic TBA address for `tokenId` (exists once minted).
    function tokenBoundAccount(uint256 tokenId) public view returns (address) {
        return registry.account(accountImpl, TBA_SALT, block.chainid, address(this), tokenId);
    }

    function setTreasury(address treasury_) external onlyOwner {
        _requirePayable(treasury_);
        treasury = treasury_;
        emit TreasuryUpdated(treasury_);
    }

    function setMintPrice(uint256 mintPrice_) external onlyOwner {
        mintPrice = mintPrice_;
        emit MintPriceUpdated(mintPrice_);
    }

    function _update(address to, uint256 tokenId, address auth) internal override returns (address from) {
        heldSince[tokenId] = block.timestamp;
        return super._update(to, tokenId, auth);
    }

    function _requireContract(address account) internal view {
        if (account.code.length == 0) revert NotAContract(account);
    }

    /// @dev A treasury that rejects ETH would brick `mint()`. Probe with an empty zero-value call:
    ///      EOAs and contracts with `receive`/`fallback` accept it, anything else reverts.
    function _requirePayable(address treasury_) internal {
        if (treasury_ == address(0)) revert ZeroAddress();
        (bool ok,) = treasury_.call{value: 0}("");
        if (!ok) revert TreasuryNotPayable(treasury_);
    }

    function _sendEth(address to, uint256 amount) internal {
        (bool ok,) = to.call{value: amount}("");
        if (!ok) revert EthTransferFailed();
    }
}

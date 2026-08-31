// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {ERC721} from '@openzeppelin/contracts/token/ERC721/ERC721.sol';

/**
 * MembershipNFT — M0. Minting condenses a member into being (the "Mote" moment):
 * each token gets a deterministic, collision-free Charter seed derived from this
 * contract's immutable mintSeed and the token's own id. The Charter is flavor and
 * identity, never funds or entitlement math — that lives in the Vault (M2) and is
 * computed purely from on-chain balances, never from anything charterOf returns.
 */
contract MembershipNFT is ERC721 {
  /// @notice Set once at deployment; scopes every Charter to this collection.
  uint256 public immutable mintSeed;

  uint256 private _nextTokenId;
  mapping(uint256 tokenId => bytes32) private _charterSeed;

  constructor(
    string memory name_,
    string memory symbol_,
    uint256 mintSeed_
  ) ERC721(name_, symbol_) {
    mintSeed = mintSeed_;
  }

  /// @notice Mint the next Membership NFT to `to`. Anyone may call — the Factory (M3)
  /// is what gates real deployments; this base contract stays permissionless by design.
  function mint(address to) external returns (uint256 tokenId) {
    tokenId = _nextTokenId++;
    _charterSeed[tokenId] = keccak256(abi.encodePacked(mintSeed, tokenId, address(this)));
    _safeMint(to, tokenId);
  }

  /// @notice The deterministic Charter seed struck at mint. Reverts for a token that
  /// was never minted — a Charter can never be read for something that doesn't exist.
  function charterOf(uint256 tokenId) external view returns (bytes32) {
    _requireOwned(tokenId);
    return _charterSeed[tokenId];
  }

  function totalMinted() external view returns (uint256) {
    return _nextTokenId;
  }
}

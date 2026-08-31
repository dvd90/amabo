// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Fixture} from "./utils/Fixture.sol";
import {Constants} from "../src/Constants.sol";
import {Factory} from "../src/Factory.sol";
import {MembershipNFT} from "../src/MembershipNFT.sol";
import {RevenueVault} from "../src/RevenueVault.sol";

/// Deploys projects under random salts/deployers and mints on random projects.
contract FactoryHandler is Test {
    Factory factory;
    Factory.Params params;
    address[] deployers;

    address[] public deployed; // every clone address ever returned
    MembershipNFT[] public nfts;
    mapping(address => bool) public seen;
    mapping(address => mapping(bytes32 => bool)) used;
    mapping(address => uint256) public mintedOn; // ghost: mints per nft
    uint256 public collisions;

    constructor(Factory factory_, Factory.Params memory params_) {
        factory = factory_;
        params = params_;
        for (uint256 i; i < 3; i++) {
            address d = makeAddr(string(abi.encodePacked("deployer", i)));
            vm.deal(d, 100 ether);
            deployers.push(d);
        }
    }

    function deploy(uint256 deployerSeed, bytes32 salt) external {
        address d = deployers[deployerSeed % deployers.length];
        if (used[d][salt]) return;
        used[d][salt] = true;
        vm.prank(d);
        (address n, address v) = factory.deploy(salt, params);
        _record(n);
        _record(v);
        nfts.push(MembershipNFT(n));
    }

    function mint(uint256 nftSeed, uint256 deployerSeed) external {
        if (nfts.length == 0) return;
        MembershipNFT n = nfts[nftSeed % nfts.length];
        if (n.totalSupply() >= n.maxSupply()) return;
        uint256 price = n.mintPrice();
        vm.prank(deployers[deployerSeed % deployers.length]);
        n.mint{value: price}();
        mintedOn[address(n)]++;
    }

    function _record(address a) internal {
        if (seen[a]) collisions++;
        seen[a] = true;
        deployed.push(a);
    }

    function nftCount() external view returns (uint256) {
        return nfts.length;
    }
}

contract FactoryInvariantTest is Fixture {
    Factory factory;
    FactoryHandler handler;

    function setUp() public override {
        super.setUp();
        factory = new Factory(address(nftImpl), address(vaultImpl), Constants.ERC6551_REGISTRY, accountImpl);
        handler = new FactoryHandler(
            factory,
            Factory.Params({
                name: "Club",
                symbol: "CLB",
                treasury: treasury,
                mintPrice: PRICE,
                maxSupply: 5,
                strategy: address(strategy)
            })
        );
        targetContract(address(handler));
    }

    /// Distinct (deployer, salt) pairs never collide.
    function invariant_DistinctSaltsNeverCollide() public view {
        assertEq(handler.collisions(), 0);
    }

    /// Mints on one project never leak into another.
    function invariant_ProjectsAreStateIsolated() public view {
        uint256 n = handler.nftCount();
        for (uint256 i; i < n; i++) {
            MembershipNFT nft_ = handler.nfts(i);
            assertEq(nft_.totalSupply(), handler.mintedOn(address(nft_)));
        }
    }
}

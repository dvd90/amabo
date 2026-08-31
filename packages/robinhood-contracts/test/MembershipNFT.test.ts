import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { expect } from 'chai';
import hre from 'hardhat';

const MINT_SEED = 0xa5a5n;

async function deployFixture() {
  const [owner, alice, bob] = await hre.ethers.getSigners();
  const MembershipNFT = await hre.ethers.getContractFactory('MembershipNFT');
  const nft = await MembershipNFT.deploy('Robinhood Membership', 'RHM', MINT_SEED);
  return { nft, owner, alice, bob };
}

describe('MembershipNFT — M0: minting condenses a member, the Charter is struck once', () => {
  it('mints sequential token ids to the recipient', async () => {
    const { nft, alice, bob } = await loadFixture(deployFixture);
    await expect(nft.mint(alice.address)).to.not.be.reverted;
    await expect(nft.mint(bob.address)).to.not.be.reverted;
    expect(await nft.ownerOf(0)).to.equal(alice.address);
    expect(await nft.ownerOf(1)).to.equal(bob.address);
    expect(await nft.totalMinted()).to.equal(2n);
  });

  it("every minted token's Charter is distinct — no two members share a seed", async () => {
    const { nft, alice } = await loadFixture(deployFixture);
    const seeds = new Set<string>();
    for (let i = 0; i < 25; i++) {
      await nft.mint(alice.address);
      seeds.add(await nft.charterOf(i));
    }
    expect(seeds.size).to.equal(25);
  });

  it('a Charter is deterministic — reading it twice returns the same seed', async () => {
    const { nft, alice } = await loadFixture(deployFixture);
    await nft.mint(alice.address);
    const first = await nft.charterOf(0);
    const second = await nft.charterOf(0);
    expect(first).to.equal(second);
  });

  it('two collections with different mintSeeds never collide on the same token id', async () => {
    const { alice } = await loadFixture(deployFixture);
    const MembershipNFT = await hre.ethers.getContractFactory('MembershipNFT');
    const a = await MembershipNFT.deploy('A', 'A', 1n);
    const b = await MembershipNFT.deploy('B', 'B', 2n);
    await a.mint(alice.address);
    await b.mint(alice.address);
    expect(await a.charterOf(0)).to.not.equal(await b.charterOf(0));
  });

  it('never trusts a Charter for a token that was never minted', async () => {
    const { nft } = await loadFixture(deployFixture);
    await expect(nft.charterOf(0)).to.be.reverted;
  });
});

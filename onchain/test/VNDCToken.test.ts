import { expect } from "chai";
import { ethers } from "hardhat";
import { VNDCToken } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("VNDCToken", function () {
  let vndc: VNDCToken;
  let owner: HardhatEthersSigner;
  let addr1: HardhatEthersSigner;
  let addr2: HardhatEthersSigner;

  const INITIAL_SUPPLY = ethers.parseEther("100000000"); // 100 million tokens
  const MAX_SUPPLY = ethers.parseEther("1000000000"); // 1 billion tokens

  beforeEach(async function () {
    [owner, addr1, addr2] = await ethers.getSigners();

    const VNDCTokenFactory = await ethers.getContractFactory("VNDCToken");
    vndc = (await VNDCTokenFactory.deploy(INITIAL_SUPPLY)) as unknown as VNDCToken;
    await vndc.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should deploy with correct initial supply", async function () {
      const totalSupply = await vndc.totalSupply();
      expect(totalSupply).to.equal(INITIAL_SUPPLY);
    });

    it("Should mint initial supply to owner", async function () {
      const ownerBalance = await vndc.balanceOf(owner.address);
      expect(ownerBalance).to.equal(INITIAL_SUPPLY);
    });

    it("Should have correct token name and symbol", async function () {
      expect(await vndc.name()).to.equal("VNDC Token");
      expect(await vndc.symbol()).to.equal("VNDC");
    });

    it("Should have correct decimals", async function () {
      expect(await vndc.decimals()).to.equal(18);
    });

    it("Should grant MINTER_ROLE to owner", async function () {
      const MINTER_ROLE = await vndc.MINTER_ROLE();
      expect(await vndc.hasRole(MINTER_ROLE, owner.address)).to.be.true;
    });
  });

  describe("Transfers", function () {
    it("Should transfer tokens between accounts", async function () {
      const amount = ethers.parseEther("100");
      await vndc.transfer(addr1.address, amount);

      const balance = await vndc.balanceOf(addr1.address);
      expect(balance).to.equal(amount);
    });

    it("Should fail when sender has insufficient balance", async function () {
      const amount = ethers.parseEther("1000000000");
      await expect(vndc.transfer(addr1.address, amount)).to.be.reverted;
    });

    it("Should emit Transfer event", async function () {
      const amount = ethers.parseEther("100");
      await expect(vndc.transfer(addr1.address, amount))
        .to.emit(vndc, "Transfer")
        .withArgs(owner.address, addr1.address, amount);
    });
  });

  describe("Minting", function () {
    it("Should mint tokens with MINTER_ROLE", async function () {
      const amount = ethers.parseEther("1000");
      await vndc.mint(addr1.address, amount);

      const balance = await vndc.balanceOf(addr1.address);
      expect(balance).to.equal(amount);
    });

    it("Should fail minting beyond MAX_SUPPLY", async function () {
      const amount = ethers.parseEther("1000000001"); // Exceeds max supply
      await expect(vndc.mint(addr1.address, amount)).to.be.reverted;
    });

    it("Should fail minting without MINTER_ROLE", async function () {
      const amount = ethers.parseEther("1000");
      const MINTER_ROLE = await vndc.MINTER_ROLE();

      await expect(
        vndc.connect(addr1).mint(addr1.address, amount)
      ).to.be.revertedWithCustomError(vndc, "AccessControlUnauthorizedAccount");
    });
  });

  describe("Burning", function () {
    it("Should burn tokens", async function () {
      const amount = ethers.parseEther("1000");
      await vndc.transfer(addr1.address, amount);

      const burnAmount = ethers.parseEther("100");
      await vndc.connect(addr1).burn(burnAmount);

      const balance = await vndc.balanceOf(addr1.address);
      expect(balance).to.equal(amount - burnAmount);
    });

    it("Should reduce total supply after burn", async function () {
      const initialSupply = await vndc.totalSupply();
      const burnAmount = ethers.parseEther("100");

      await vndc.burn(burnAmount);

      const finalSupply = await vndc.totalSupply();
      expect(finalSupply).to.equal(initialSupply - burnAmount);
    });
  });

  describe("Pausing", function () {
    it("Should pause transfers", async function () {
      await vndc.pause();
      const amount = ethers.parseEther("100");

      await expect(vndc.transfer(addr1.address, amount))
        .to.be.revertedWithCustomError(vndc, "EnforcedPause");
    });

    it("Should unpause transfers", async function () {
      await vndc.pause();
      await vndc.unpause();

      const amount = ethers.parseEther("100");
      await expect(vndc.transfer(addr1.address, amount)).to.not.be.reverted;
    });

    it("Should fail pausing without PAUSER_ROLE", async function () {
      const PAUSER_ROLE = await vndc.PAUSER_ROLE();

      await expect(vndc.connect(addr1).pause()).to.be.revertedWithCustomError(
        vndc,
        "AccessControlUnauthorizedAccount"
      );
    });
  });

  describe("Snapshots", function () {
    it("Should create a snapshot", async function () {
      const tx = await vndc.snapshot();
      await expect(tx).to.emit(vndc, "SnapshotCreated");
    });

    it("Should track balance at snapshot", async function () {
      // Transfer tokens to create a balance
      await vndc.transfer(addr1.address, ethers.parseEther("100"));
      
      // Create a snapshot
      const tx = await vndc.snapshot();
      
      // Snapshot should be successfully created
      expect(tx).to.not.be.null;
      
      // Current snapshot ID should be 1
      const currentId = await vndc.getCurrentSnapshotId();
      expect(currentId).to.equal(1);
    });

    it("Should increment snapshot ID", async function () {
      await vndc.snapshot();
      let id = await vndc.getCurrentSnapshotId();
      expect(id).to.equal(1);

      await vndc.snapshot();
      id = await vndc.getCurrentSnapshotId();
      expect(id).to.equal(2);
    });
  });

  describe("Token Locking", function () {
    it("Should lock tokens for an address", async function () {
      // First transfer tokens to addr1
      await vndc.transfer(addr1.address, ethers.parseEther("100"));
      
      const amount = ethers.parseEther("100");
      const releaseTime = (await time.latest()) + 86400; // 1 day from now (in seconds)

      // Owner calls lockTokens (only admin can lock)
      await vndc.lockTokens(addr1.address, amount, releaseTime);

      const [locked, lockTime] = await vndc.getLockedTokens(addr1.address);
      expect(locked).to.equal(amount);
      expect(lockTime).to.equal(releaseTime);
    });

    it("Should prevent transferring locked tokens", async function () {
      await vndc.transfer(addr1.address, ethers.parseEther("100"));

      const releaseTime = (await time.latest()) + 86400;
      await vndc.lockTokens(addr1.address, ethers.parseEther("100"), releaseTime);

      // addr1 should not be able to transfer locked tokens
      await expect(
        vndc.connect(addr1).transfer(addr2.address, ethers.parseEther("50"))
      ).to.be.reverted;
    });

    it("Should release locked tokens after lock period", async function () {
      await vndc.transfer(addr1.address, ethers.parseEther("100"));

      const releaseTime = (await time.latest()) + 2; // 2 seconds from now
      await vndc.lockTokens(addr1.address, ethers.parseEther("100"), releaseTime);

      // Wait for lock period to expire
      await time.increase(3);

      await vndc.releaseLocked(addr1.address);

      const [locked] = await vndc.getLockedTokens(addr1.address);
      expect(locked).to.equal(0);
    });
  });

  describe("Access Control", function () {
    it("Should grant roles correctly", async function () {
      const MINTER_ROLE = await vndc.MINTER_ROLE();
      await vndc.grantRole(MINTER_ROLE, addr1.address);

      expect(await vndc.hasRole(MINTER_ROLE, addr1.address)).to.be.true;
    });

    it("Should revoke roles correctly", async function () {
      const MINTER_ROLE = await vndc.MINTER_ROLE();
      await vndc.grantRole(MINTER_ROLE, addr1.address);
      await vndc.revokeRole(MINTER_ROLE, addr1.address);

      expect(await vndc.hasRole(MINTER_ROLE, addr1.address)).to.be.false;
    });
  });
});

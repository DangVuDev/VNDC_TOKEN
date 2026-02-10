import { expect as chaiExpect } from "chai";
import { ethers } from "hardhat";
import { VNDC } from "../../../typechain";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

// Use any to bypass TypeScript type checking for Hardhat-specific matchers
const expect = chaiExpect as any;

describe("VNDC Token Simple Tests", () => {
  let vndc: VNDC;
  let owner: SignerWithAddress;
  let addr1: SignerWithAddress;

  beforeEach(async () => {
    [owner, addr1] = await ethers.getSigners();
    const VNDC_Factory = await ethers.getContractFactory("VNDC");
    vndc = await VNDC_Factory.deploy(ethers.parseEther("1000000000"));
    await vndc.waitForDeployment();
  });

  describe("Basic Functionality", () => {
    it("should have correct name and symbol", async () => {
      expect(await vndc.name()).to.equal("Vietnam Digital Currency");
      expect(await vndc.symbol()).to.equal("VNDC");
    });

    it("should have 18 decimals", async () => {
      expect(await vndc.decimals()).to.equal(18n);
    });

    it("should have correct initial supply", async () => {
      const balance = await vndc.balanceOf(owner.address);
      expect(balance).to.equal(ethers.parseEther("1000000000"));
    });

    it("should transfer tokens correctly", async () => {
      const amount = ethers.parseEther("100");
      await vndc.transfer(addr1.address, amount);
      const balance = await vndc.balanceOf(addr1.address);
      expect(balance).to.equal(amount);
    });

    it("should mint tokens when authorized", async () => {
      const amount = ethers.parseEther("100");
      await vndc.mint(addr1.address, amount);
      const balance = await vndc.balanceOf(addr1.address);
      expect(balance).to.equal(amount);
    });

    it("should burn tokens from caller", async () => {
      const amount = ethers.parseEther("100");
      const initialBalance = await vndc.balanceOf(owner.address);
      await vndc.burn(amount);
      const newBalance = await vndc.balanceOf(owner.address);
      expect(newBalance).to.equal(initialBalance - amount);
    });

    it("should allow pause/unpause", async () => {
      await vndc.pause();
      const isPaused = await vndc.paused();
      expect(isPaused).to.be.true;
      
      await vndc.unpause();
      const isUnpaused = await vndc.paused();
      expect(isUnpaused).to.be.false;
    });

    it("should prevent transfers when paused", async () => {
      await vndc.pause();
      const amount = ethers.parseEther("100");
      try {
        await vndc.transfer(addr1.address, amount);
        expect.fail("Should have reverted");
      } catch (e: any) {
        expect(e.message).to.include("EnforcedPause");
      }
    });

    it("should manage minters", async () => {
      expect(await vndc.isMinter(addr1.address)).to.be.false;
      await vndc.addMinter(addr1.address);
      expect(await vndc.isMinter(addr1.address)).to.be.true;
      await vndc.removeMinter(addr1.address);
      expect(await vndc.isMinter(addr1.address)).to.be.false;
    });

    it("should manage burners", async () => {
      expect(await vndc.isBurner(addr1.address)).to.be.false;
      await vndc.addBurner(addr1.address);
      expect(await vndc.isBurner(addr1.address)).to.be.true;
      await vndc.removeBurner(addr1.address);
      expect(await vndc.isBurner(addr1.address)).to.be.false;
    });

    it("should return correct token info", async () => {
      const [name, symbol, decimals, totalSupply] = await vndc.getTokenInfo();
      expect(name).to.equal("Vietnam Digital Currency");
      expect(symbol).to.equal("VNDC");
      expect(decimals).to.equal(18n);
      expect(totalSupply).to.equal(ethers.parseEther("1000000000"));
    });
  });

  describe("Error Cases", () => {
    it("should fail to transfer with insufficient balance", async () => {
      const amount = ethers.parseEther("2000000000"); // More than total supply
      try {
        await vndc.connect(addr1).transfer(owner.address, amount);
        expect.fail("Should have reverted");
      } catch (e: any) {
        expect(e.message).to.include("revert");
      }
    });

    it("should fail to mint if not authorized", async () => {
      const amount = ethers.parseEther("100");
      try {
        await vndc.connect(addr1).mint(addr1.address, amount);
        expect.fail("Should have reverted");
      } catch (e: any) {
        expect(e.message).to.include("Unauthorized");
      }
    });

    it("should fail to burn more than balance", async () => {
      const amount = ethers.parseEther("1000000000000"); // Way more than any account has
      try {
        await vndc.connect(addr1).burn(amount);
        expect.fail("Should have reverted");
      } catch (e: any) {
        expect(e.message).to.include("revert");
      }
    });
  });
});

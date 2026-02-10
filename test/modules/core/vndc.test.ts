import { expect as chaiExpect } from "chai";
import "@nomicfoundation/hardhat-chai-matchers";
import { ethers } from "hardhat";
import { VNDC } from "../../../typechain";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

// Use any to bypass TypeScript type checking for Hardhat-specific matchers
const expect = chaiExpect as any;

describe("VNDC Token Tests", () => {
  let vndc: VNDC;
  let owner: SignerWithAddress;
  let addr1: SignerWithAddress;
  let addr2: SignerWithAddress;
  let addrs: SignerWithAddress[];

  const INITIAL_SUPPLY = ethers.parseEther("1000000000"); // 1 billion

  before(async () => {
    [owner, addr1, addr2, ...addrs] = await ethers.getSigners();
  });

  beforeEach(async () => {
    const VNDC_Factory = await ethers.getContractFactory("VNDC");
    vndc = await VNDC_Factory.deploy(ethers.parseEther("1000000000"));
    await vndc.waitForDeployment();
  });

  describe("Deployment", () => {
    it("should have correct name and symbol", async () => {
      expect(await vndc.name()).to.equal("Vietnam Digital Currency");
      expect(await vndc.symbol()).to.equal("VNDC");
    });

    it("should have 18 decimals", async () => {
      expect(await vndc.decimals()).to.equal(18n);
    });

    it("should mint initial supply to deployer", async () => {
      const balance = await vndc.balanceOf(owner.address);
      expect(balance).to.equal(INITIAL_SUPPLY);
    });

    it("should set correct total supply", async () => {
      const totalSupply = await vndc.totalSupply();
      expect(totalSupply).to.equal(INITIAL_SUPPLY);
    });

    it("should set owner as minter and burner", async () => {
      expect(await vndc.isMinter(owner.address)).to.be.true;
      expect(await vndc.isBurner(owner.address)).to.be.true;
    });
  });

  describe("Transfer", () => {
    it("should transfer tokens between accounts", async () => {
      const amount = ethers.parseEther("100");

      await expect(vndc.transfer(addr1.address, amount))
        .to.emit(vndc, "Transfer")
        .withArgs(owner.address, addr1.address, amount);

      const balance = await vndc.balanceOf(addr1.address);
      expect(balance).to.equal(amount);
    });

    it("should fail if sender has insufficient balance", async () => {
      const amount = ethers.parseEther("1000000000000");
      await expect(
        vndc.transfer(addr1.address, amount)
      ).to.be.revertedWithCustomError(vndc, "ERC20InsufficientBalance");
    });

    it("should fail if sender is paused", async () => {
      const amount = ethers.parseEther("100");
      await vndc.pause();

      await expect(
        vndc.transfer(addr1.address, amount)
      ).to.be.revertedWithCustomError(vndc, "EnforcedPause");
    });
  });

  describe("Mint", () => {
    it("should mint tokens when authorized", async () => {
      const amount = ethers.parseEther("1000");

      await expect(vndc.mint(addr1.address, amount))
        .to.emit(vndc, "Transfer")
        .withArgs(ethers.ZeroAddress, addr1.address, amount);

      const balance = await vndc.balanceOf(addr1.address);
      expect(balance).to.equal(amount);
    });

    it("should fail if caller is not minter", async () => {
      const amount = ethers.parseEther("100");

      await expect(
        vndc.connect(addr1).mint(addr2.address, amount)
      ).to.be.revertedWith("VNDC: Caller is not a minter");
    });

    it("should fail to mint to zero address", async () => {
      const amount = ethers.parseEther("100");

      await expect(vndc.mint(ethers.ZeroAddress, amount)).to.be.revertedWith(
        "VNDC: Cannot mint to zero address"
      );
    });

    it("should fail to mint zero amount", async () => {
      await expect(
        vndc.mint(addr1.address, ethers.parseEther("0"))
      ).to.be.revertedWith("VNDC: Amount must be greater than 0");
    });
  });

  describe("Burn", () => {
    beforeEach(async () => {
      await vndc.transfer(addr1.address, ethers.parseEther("500"));
    });

    it("should burn tokens from caller", async () => {
      const amount = ethers.parseEther("100");
      const balanceBefore = await vndc.balanceOf(addr1.address);

      await expect(vndc.connect(addr1).burn(amount))
        .to.emit(vndc, "Transfer")
        .withArgs(addr1.address, ethers.ZeroAddress, amount);

      const balanceAfter = await vndc.balanceOf(addr1.address);
      expect(balanceAfter).to.equal(balanceBefore - amount);
    });

    it("should fail to burn zero amount", async () => {
      await expect(
        vndc.connect(addr1).burn(ethers.parseEther("0"))
      ).to.be.revertedWith("VNDC: Amount must be greater than 0");
    });

    it("should fail to burn more than balance", async () => {
      const amount = ethers.parseEther("1000000");
      await expect(
        vndc.connect(addr1).burn(amount)
      ).to.be.revertedWithCustomError(vndc, "ERC20InsufficientBalance");
    });
  });

  describe("BurnFrom", () => {
    beforeEach(async () => {
      await vndc.transfer(addr1.address, ethers.parseEther("500"));
      await vndc.addBurner(addr2.address);
      await vndc.connect(addr1).approve(addr2.address, ethers.parseEther("1000"));
    });

    it("should burn tokens from another account if authorized", async () => {
      const amount = ethers.parseEther("100");

      await expect(vndc.connect(addr2).burnFrom(addr1.address, amount))
        .to.emit(vndc, "Transfer")
        .withArgs(addr1.address, ethers.ZeroAddress, amount);

      const balance = await vndc.balanceOf(addr1.address);
      expect(balance).to.equal(ethers.parseEther("400"));
    });

    it("should fail if caller is not burner", async () => {
      const amount = ethers.parseEther("100");

      await expect(
        vndc.connect(addr1).burnFrom(addr1.address, amount)
      ).to.be.revertedWith("VNDC: Caller is not a burner");
    });
  });

  describe("Minter Management", () => {
    it("should add minter", async () => {
      expect(await vndc.isMinter(addr1.address)).to.be.false;

      await vndc.addMinter(addr1.address);

      expect(await vndc.isMinter(addr1.address)).to.be.true;
    });

    it("should remove minter", async () => {
      await vndc.addMinter(addr1.address);
      expect(await vndc.isMinter(addr1.address)).to.be.true;

      await vndc.removeMinter(addr1.address);

      expect(await vndc.isMinter(addr1.address)).to.be.false;
    });

    it("should fail to add minter if not owner", async () => {
      await expect(
        vndc.connect(addr1).addMinter(addr2.address)
      ).to.be.revertedWithCustomError(vndc, "OwnableUnauthorizedAccount");
    });
  });

  describe("Burner Management", () => {
    it("should add burner", async () => {
      expect(await vndc.isBurner(addr1.address)).to.be.false;

      await vndc.addBurner(addr1.address);

      expect(await vndc.isBurner(addr1.address)).to.be.true;
    });

    it("should remove burner", async () => {
      await vndc.addBurner(addr1.address);
      await vndc.removeBurner(addr1.address);

      expect(await vndc.isBurner(addr1.address)).to.be.false;
    });
  });

  describe("Pausable", () => {
    it("should pause transfers", async () => {
      const amount = ethers.parseEther("100");

      await vndc.pause();
      expect(await vndc.isPaused()).to.be.true;

      await expect(
        vndc.transfer(addr1.address, amount)
      ).to.be.revertedWithCustomError(vndc, "EnforcedPause");
    });

    it("should resume after unpause", async () => {
      const amount = ethers.parseEther("100");

      await vndc.pause();
      await vndc.unpause();

      expect(await vndc.isPaused()).to.be.false;

      await expect(vndc.transfer(addr1.address, amount))
        .to.emit(vndc, "Transfer");
    });

    it("should fail to pause if not owner", async () => {
      await expect(vndc.connect(addr1).pause()).to.be.revertedWithCustomError(
        vndc,
        "OwnableUnauthorizedAccount"
      );
    });
  });

  describe("Permit (ERC-2612)", () => {
    it("should permit spending without approval transaction", async () => {
      const amount = ethers.parseEther("100");
      const deadline = Math.floor(Date.now() / 1000) + 3600;

      const domain = {
        name: "Vietnam Digital Currency",
        version: "1",
        chainId: (await ethers.provider.getNetwork()).chainId,
        verifyingContract: await vndc.getAddress(),
      };

      const types = {
        Permit: [
          { name: "owner", type: "address" },
          { name: "spender", type: "address" },
          { name: "value", type: "uint256" },
          { name: "nonce", type: "uint256" },
          { name: "deadline", type: "uint256" },
        ],
      };

      const value = {
        owner: owner.address,
        spender: addr1.address,
        value: amount,
        nonce: 0,
        deadline,
      };

      const sig = await owner.signTypedData(domain, types, value);
      const { v, r, s } = ethers.Signature.from(sig);

      await expect(
        vndc.permit(owner.address, addr1.address, amount, deadline, v, r, s)
      )
        .to.emit(vndc, "Approval")
        .withArgs(owner.address, addr1.address, amount);

      const allowance = await vndc.allowance(owner.address, addr1.address);
      expect(allowance).to.equal(amount);
    });
  });

  describe("Metadata", () => {
    it("should return correct token info", async () => {
      const [name, symbol, decimals, totalSupply] =
        await vndc.getTokenInfo();

      expect(name).to.equal("Vietnam Digital Currency");
      expect(symbol).to.equal("VNDC");
      expect(decimals).to.equal(18n);
      expect(totalSupply).to.equal(INITIAL_SUPPLY);
    });
  });
});

import { expect } from "chai";
import { ethers } from "hardhat";
import { VNDCToken, VNDCStaking } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("VNDCStaking", function () {
  let vndc: VNDCToken;
  let staking: VNDCStaking;
  let owner: HardhatEthersSigner;
  let addr1: HardhatEthersSigner;
  let addr2: HardhatEthersSigner;

  const INITIAL_SUPPLY = ethers.parseEther("1000000000"); // 1 billion
  const STAKE_AMOUNT = ethers.parseEther("1000");
  const THREE_MONTHS = 90 * 24 * 60 * 60; // 90 days
  const SIX_MONTHS = 180 * 24 * 60 * 60;

  beforeEach(async function () {
    [owner, addr1, addr2] = await ethers.getSigners();

    // Deploy token
    const VNDCTokenFactory = await ethers.getContractFactory("VNDCToken");
    vndc = (await VNDCTokenFactory.deploy(INITIAL_SUPPLY)) as unknown as VNDCToken;
    await vndc.waitForDeployment();

    // Deploy staking
    const VNDCStakingFactory = await ethers.getContractFactory("VNDCStaking");
    staking = (await VNDCStakingFactory.deploy(await vndc.getAddress())) as unknown as VNDCStaking;
    await staking.waitForDeployment();

    // Transfer tokens to stakers
    await vndc.transfer(addr1.address, ethers.parseEther("10000"));
    await vndc.transfer(addr2.address, ethers.parseEther("10000"));

    // Transfer tokens to staking contract for rewards
    await vndc.transfer(await staking.getAddress(), ethers.parseEther("100000000")); // 100M for rewards

    // Approve staking contract
    await vndc.connect(addr1).approve(await staking.getAddress(), ethers.MaxUint256);
    await vndc.connect(addr2).approve(await staking.getAddress(), ethers.MaxUint256);
  });

  describe("Deployment", function () {
    it("Should deploy with correct token address", async function () {
      expect(await staking.vndc()).to.equal(await vndc.getAddress());
    });

    it("Should have correct default reward rate", async function () {
      expect(await staking.rewardRate()).to.equal(1000); // 10%
    });

    it("Should have staking multipliers set", async function () {
      const multiplier = await staking.stakingMultipliers(THREE_MONTHS);
      expect(multiplier).to.equal(10000); // 100%
    });
  });

  describe("Staking", function () {
    it("Should stake tokens successfully", async function () {
      await staking.connect(addr1).stake(STAKE_AMOUNT, THREE_MONTHS);

      const userStake = await staking.getStake(addr1.address);
      expect(userStake.amount).to.equal(STAKE_AMOUNT);
      expect(userStake.duration).to.equal(THREE_MONTHS);
      expect(userStake.locked).to.be.true;
    });

    it("Should fail staking below minimum amount", async function () {
      const minAmount = await staking.minStakeAmount();
      const lowAmount = minAmount / BigInt(2);

      await expect(staking.connect(addr1).stake(lowAmount, THREE_MONTHS)).to.be.reverted;
    });

    it("Should fail staking with invalid duration", async function () {
      await expect(staking.connect(addr1).stake(STAKE_AMOUNT, 1000)).to.be.reverted;
    });

    it("Should fail staking if already staking", async function () {
      await staking.connect(addr1).stake(STAKE_AMOUNT, THREE_MONTHS);

      await expect(staking.connect(addr1).stake(STAKE_AMOUNT, SIX_MONTHS)).to.be
        .reverted;
    });

    it("Should update total staked", async function () {
      await staking.connect(addr1).stake(STAKE_AMOUNT, THREE_MONTHS);

      expect(await staking.totalStaked()).to.equal(STAKE_AMOUNT);
    });
  });

  describe("Rewards", function () {
    it("Should calculate pending rewards correctly", async function () {
      await staking.connect(addr1).stake(STAKE_AMOUNT, THREE_MONTHS);

      // Fast forward 1 month
      await time.increase(30 * 24 * 60 * 60);

      const rewards = await staking.calculatePendingRewards(addr1.address);
      expect(rewards).to.be.greaterThan(0);
    });

    it("Should apply staking multiplier to rewards", async function () {
      await staking.connect(addr1).stake(STAKE_AMOUNT, THREE_MONTHS);
      await staking.connect(addr2).stake(STAKE_AMOUNT, SIX_MONTHS);

      // Fast forward 1 month
      await time.increase(30 * 24 * 60 * 60);

      const rewards1 = await staking.calculatePendingRewards(addr1.address);
      const rewards2 = await staking.calculatePendingRewards(addr2.address);

      // addr2 should have more rewards due to 6-month multiplier
      expect(rewards2).to.be.greaterThan(rewards1);
    });

    it("Should claim rewards with auto-compounding", async function () {
      await staking.connect(addr1).stake(STAKE_AMOUNT, THREE_MONTHS);

      await time.increase(30 * 24 * 60 * 60);

      const rewardsBefore = await staking.calculatePendingRewards(addr1.address);
      await staking.connect(addr1).claimRewards();

      const userStake = await staking.getStake(addr1.address);
      expect(userStake.amount).to.be.greaterThan(STAKE_AMOUNT);
      expect(userStake.rewards).to.equal(0);
    });
  });

  describe("Unstaking", function () {
    it("Should fail unstaking before lock period ends", async function () {
      await staking.connect(addr1).stake(STAKE_AMOUNT, THREE_MONTHS);

      await expect(staking.connect(addr1).unstake()).to.be.reverted;
    });

    it("Should unstake after lock period", async function () {
      await staking.connect(addr1).stake(STAKE_AMOUNT, THREE_MONTHS);

      await time.increase(THREE_MONTHS + 1);

      const balanceBefore = await vndc.balanceOf(addr1.address);
      await staking.connect(addr1).unstake();
      const balanceAfter = await vndc.balanceOf(addr1.address);

      expect(balanceAfter).to.be.greaterThan(balanceBefore);
    });

    it("Should clear stake after unstaking", async function () {
      await staking.connect(addr1).stake(STAKE_AMOUNT, THREE_MONTHS);

      await time.increase(THREE_MONTHS + 1);
      await staking.connect(addr1).unstake();

      const userStake = await staking.getStake(addr1.address);
      expect(userStake.amount).to.equal(0);
    });
  });

  describe("Emergency Unstake", function () {
    it("Should allow emergency unstake before lock period", async function () {
      await staking.connect(addr1).stake(STAKE_AMOUNT, THREE_MONTHS);

      const balanceBefore = await vndc.balanceOf(addr1.address);
      await staking.connect(addr1).emergencyUnstake();
      const balanceAfter = await vndc.balanceOf(addr1.address);

      expect(balanceAfter).to.be.greaterThan(balanceBefore);
    });

    it("Should apply 50% penalty on rewards for emergency unstake", async function () {
      await staking.connect(addr1).stake(STAKE_AMOUNT, THREE_MONTHS);

      await time.increase(30 * 24 * 60 * 60);

      const rewards = await staking.calculatePendingRewards(addr1.address);
      const expectedReturn = STAKE_AMOUNT + (rewards * BigInt(50)) / BigInt(100);

      const balanceBefore = await vndc.balanceOf(addr1.address);
      await staking.connect(addr1).emergencyUnstake();
      const balanceAfter = await vndc.balanceOf(addr1.address);

      expect(balanceAfter - balanceBefore).to.be.closeTo(expectedReturn, ethers.parseEther("0.1"));
    });
  });

  describe("Admin Functions", function () {
    it("Should update reward rate", async function () {
      await staking.setRewardRate(2000); // 20%

      expect(await staking.rewardRate()).to.equal(2000);
    });

    it("Should fail updating reward rate above maximum", async function () {
      await expect(staking.setRewardRate(6000)).to.be.reverted; // > 50%
    });

    it("Should set staking multiplier", async function () {
      await staking.setStakingMultiplier(365 * 24 * 60 * 60, 20000);

      const multiplier = await staking.stakingMultipliers(365 * 24 * 60 * 60);
      expect(multiplier).to.equal(20000);
    });

    it("Should update minimum stake amount", async function () {
      const newMin = ethers.parseEther("500");
      await staking.setMinStakeAmount(newMin);

      expect(await staking.minStakeAmount()).to.equal(newMin);
    });

    it("Should fail admin functions for non-admin", async function () {
      await expect(staking.connect(addr1).setRewardRate(2000)).to.be.reverted;
    });
  });

  describe("View Functions", function () {
    it("Should calculate time to unlock correctly", async function () {
      await staking.connect(addr1).stake(STAKE_AMOUNT, THREE_MONTHS);

      const timeToUnlock = await staking.getTimeToUnlock(addr1.address);
      expect(timeToUnlock).to.be.closeTo(BigInt(THREE_MONTHS), BigInt(10));
    });

    it("Should return 0 for time to unlock if already unlocked", async function () {
      await staking.connect(addr1).stake(STAKE_AMOUNT, THREE_MONTHS);

      await time.increase(THREE_MONTHS + 1);

      const timeToUnlock = await staking.getTimeToUnlock(addr1.address);
      expect(timeToUnlock).to.equal(0);
    });
  });
});

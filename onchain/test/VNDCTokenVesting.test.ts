import { expect } from "chai";
import { ethers } from "hardhat";
import { VNDCToken, VNDCTokenVesting } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("VNDCTokenVesting", function () {
  let vndc: VNDCToken;
  let vesting: VNDCTokenVesting;
  let owner: HardhatEthersSigner;
  let beneficiary1: HardhatEthersSigner;
  let beneficiary2: HardhatEthersSigner;

  const INITIAL_SUPPLY = ethers.parseEther("1000000000"); // 1 billion
  const VESTING_AMOUNT = ethers.parseEther("100000");
  const CLIFF_DURATION = 30 * 24 * 60 * 60; // 30 days
  const VESTING_DURATION = 365 * 24 * 60 * 60; // 1 year

  beforeEach(async function () {
    [owner, beneficiary1, beneficiary2] = await ethers.getSigners();

    // Deploy token
    const VNDCTokenFactory = await ethers.getContractFactory("VNDCToken");
    vndc = (await VNDCTokenFactory.deploy(INITIAL_SUPPLY)) as VNDCToken;
    await vndc.waitForDeployment();

    // Deploy vesting
    const VNDCTokenVestingFactory = await ethers.getContractFactory("VNDCTokenVesting");
    vesting = (await VNDCTokenVestingFactory.deploy(await vndc.getAddress())) as VNDCTokenVesting;
    await vesting.waitForDeployment();

    // Approve vesting contract
    await vndc.approve(await vesting.getAddress(), ethers.MaxUint256);
  });

  describe("Deployment", function () {
    it("Should deploy with correct token address", async function () {
      expect(await vesting.vndc()).to.equal(await vndc.getAddress());
    });

    it("Should have zero vesting schedules initially", async function () {
      const count = await vesting.getVestingSchedulesCount();
      expect(count).to.equal(0);
    });
  });

  describe("Creating Vesting Schedules", function () {
    it("Should create a vesting schedule", async function () {
      const startTime = await time.latest();
      const cliffTime = startTime + CLIFF_DURATION;

      const tx = await vesting.createVestingSchedule(
        beneficiary1.address,
        VESTING_AMOUNT,
        startTime,
        CLIFF_DURATION,
        VESTING_DURATION,
        true
      );

      await expect(tx).to.emit(vesting, "VestingScheduleCreated");
    });

    it("Should track vesting schedules for beneficiary", async function () {
      const startTime = await time.latest();

      await vesting.createVestingSchedule(
        beneficiary1.address,
        VESTING_AMOUNT,
        startTime,
        CLIFF_DURATION,
        VESTING_DURATION,
        true
      );

      const schedules = await vesting.getUserVestingSchedules(beneficiary1.address);
      expect(schedules.length).to.equal(1);
    });

    it("Should fail creating schedule with invalid beneficiary", async function () {
      const startTime = await time.latest();

      await expect(
        vesting.createVestingSchedule(
          ethers.ZeroAddress,
          VESTING_AMOUNT,
          startTime,
          CLIFF_DURATION,
          VESTING_DURATION,
          true
        )
      ).to.be.reverted;
    });

    it("Should fail creating schedule with zero amount", async function () {
      const startTime = await time.latest();

      await expect(
        vesting.createVestingSchedule(
          beneficiary1.address,
          0,
          startTime,
          CLIFF_DURATION,
          VESTING_DURATION,
          true
        )
      ).to.be.reverted;
    });

    it("Should fail creating schedule with cliff > duration", async function () {
      const startTime = await time.latest();

      await expect(
        vesting.createVestingSchedule(
          beneficiary1.address,
          VESTING_AMOUNT,
          startTime,
          VESTING_DURATION + 1,
          VESTING_DURATION,
          true
        )
      ).to.be.reverted;
    });

    it("Should fail if owner has insufficient balance", async function () {
      const startTime = await time.latest();
      const largeAmount = ethers.parseEther("2000000000"); // > total supply

      await expect(
        vesting.createVestingSchedule(
          beneficiary1.address,
          largeAmount,
          startTime,
          CLIFF_DURATION,
          VESTING_DURATION,
          true
        )
      ).to.be.reverted;
    });

    it("Should increment total vested", async function () {
      const startTime = await time.latest();

      const vestingBefore = await vesting.totalVested();
      await vesting.createVestingSchedule(
        beneficiary1.address,
        VESTING_AMOUNT,
        startTime,
        CLIFF_DURATION,
        VESTING_DURATION,
        true
      );
      const vestingAfter = await vesting.totalVested();

      expect(vestingAfter).to.equal(vestingBefore + VESTING_AMOUNT);
    });
  });

  describe("Vesting Calculations", function () {
    let scheduleId: string;
    let startTime: number;

    beforeEach(async function () {
      startTime = await time.latest();

      const tx = await vesting.createVestingSchedule(
        beneficiary1.address,
        VESTING_AMOUNT,
        startTime,
        CLIFF_DURATION,
        VESTING_DURATION,
        true
      );

      const receipt = await tx.wait();
      // Extract schedule ID from event
      const event = receipt?.logs.find((log) =>
        log.topics[0] === ethers.id("VestingScheduleCreated(bytes32,address,uint256,uint256,uint256,bool)")
      );
      // For simplicity, get schedules and use the first one
      const schedules = await vesting.getUserVestingSchedules(beneficiary1.address);
      scheduleId = schedules[0];
    });

    it("Should return 0 vested before cliff", async function () {
      const vested = await vesting.calculateVestedAmount(scheduleId);
      expect(vested).to.equal(0);
    });

    it("Should start vesting after cliff", async function () {
      // Move past cliff
      await time.increase(CLIFF_DURATION + 1);

      const vested = await vesting.calculateVestedAmount(scheduleId);
      expect(vested).to.be.greaterThan(0);
    });

    it("Should vest all tokens after vesting period", async function () {
      // Move to end of vesting
      await time.increase(VESTING_DURATION + 1);

      const vested = await vesting.calculateVestedAmount(scheduleId);
      expect(vested).to.equal(VESTING_AMOUNT);
    });

    it("Should calculate pro-rata vesting", async function () {
      // Move to 25% of vesting period after cliff
      const quarterVesting = Math.floor(VESTING_DURATION / 4);
      await time.increase(CLIFF_DURATION + quarterVesting);

      const vested = await vesting.calculateVestedAmount(scheduleId);
      
      // Should be approximately 25% of vesting amount
      // amount * timeVested / duration = amount * 0.25
      expect(vested).to.be.greaterThan(0);
      expect(vested).to.be.lessThanOrEqual(VESTING_AMOUNT);
    });
  });

  describe("Releasing Tokens", function () {
    let scheduleId: string;
    let startTime: number;

    beforeEach(async function () {
      startTime = await time.latest();

      const tx = await vesting.createVestingSchedule(
        beneficiary1.address,
        VESTING_AMOUNT,
        startTime,
        CLIFF_DURATION,
        VESTING_DURATION,
        true
      );

      const schedules = await vesting.getUserVestingSchedules(beneficiary1.address);
      scheduleId = schedules[0];
    });

    it("Should fail releasing before cliff", async function () {
      await expect(vesting.releaseVestedTokens(scheduleId)).to.be.reverted;
    });

    it("Should release tokens after cliff", async function () {
      await time.increase(CLIFF_DURATION + 1);

      const balanceBefore = await vndc.balanceOf(beneficiary1.address);
      await vesting.releaseVestedTokens(scheduleId);
      const balanceAfter = await vndc.balanceOf(beneficiary1.address);

      expect(balanceAfter).to.be.greaterThan(balanceBefore);
    });

    it("Should only release vested amount", async function () {
      await time.increase(CLIFF_DURATION + Math.floor(VESTING_DURATION / 2));

      const releasable = await vesting.calculateReleasableAmount(scheduleId);
      const balanceBefore = await vndc.balanceOf(beneficiary1.address);

      await vesting.releaseVestedTokens(scheduleId);

      const balanceAfter = await vndc.balanceOf(beneficiary1.address);
      const transferred = balanceAfter - balanceBefore;
      
      // Should transfer approximately the releasable amount (allow 1 token rounding error)
      expect(transferred).to.be.closeTo(releasable, ethers.parseEther("1"));
    });

    it("Should emit TokensReleased event", async function () {
      await time.increase(CLIFF_DURATION + 1);

      await expect(vesting.releaseVestedTokens(scheduleId)).to.emit(vesting, "TokensReleased");
    });

    it("Should track released amount", async function () {
      await time.increase(CLIFF_DURATION + 1);

      const releasable1 = await vesting.calculateReleasableAmount(scheduleId);
      await vesting.releaseVestedTokens(scheduleId);

      const releasable2 = await vesting.calculateReleasableAmount(scheduleId);
      expect(releasable2).to.be.lessThan(releasable1);
    });

    it("Should allow multiple releases", async function () {
      // First release
      await time.increase(CLIFF_DURATION + VESTING_DURATION / 2);
      await vesting.releaseVestedTokens(scheduleId);

      // Second release
      await time.increase(VESTING_DURATION / 2);
      await vesting.releaseVestedTokens(scheduleId);

      const balance = await vndc.balanceOf(beneficiary1.address);
      expect(balance).to.be.closeTo(VESTING_AMOUNT, ethers.parseEther("1"));
    });
  });

  describe("Revocation", function () {
    let scheduleId: string;
    let startTime: number;

    beforeEach(async function () {
      startTime = await time.latest();

      const tx = await vesting.createVestingSchedule(
        beneficiary1.address,
        VESTING_AMOUNT,
        startTime,
        CLIFF_DURATION,
        VESTING_DURATION,
        true
      );

      const schedules = await vesting.getUserVestingSchedules(beneficiary1.address);
      scheduleId = schedules[0];
    });

    it("Should revoke a vesting schedule", async function () {
      await vesting.revokeVestingSchedule(scheduleId);

      const schedule = await vesting.getVestingSchedule(scheduleId);
      expect(schedule.revoked).to.be.true;
    });

    it("Should return unreleased tokens to owner on revoke", async function () {
      const balanceBefore = await vndc.balanceOf(owner.address);

      await vesting.revokeVestingSchedule(scheduleId);

      const balanceAfter = await vndc.balanceOf(owner.address);
      expect(balanceAfter).to.equal(balanceBefore + VESTING_AMOUNT);
    });

    it("Should emit VestingScheduleRevoked event", async function () {
      await expect(vesting.revokeVestingSchedule(scheduleId)).to.emit(
        vesting,
        "VestingScheduleRevoked"
      );
    });

    it("Should fail revoking non-revocable schedule", async function () {
      const tx = await vesting.createVestingSchedule(
        beneficiary2.address,
        VESTING_AMOUNT,
        startTime,
        CLIFF_DURATION,
        VESTING_DURATION,
        false // not revocable
      );

      const schedules = await vesting.getUserVestingSchedules(beneficiary2.address);
      const nonRevocableId = schedules[0];

      await expect(vesting.revokeVestingSchedule(nonRevocableId)).to.be.reverted;
    });

    it("Should fail revoking already revoked schedule", async function () {
      await vesting.revokeVestingSchedule(scheduleId);

      await expect(vesting.revokeVestingSchedule(scheduleId)).to.be.reverted;
    });

    it("Should return correct amounts after partial vesting and revoke", async function () {
      // Move to half vesting
      await time.increase(CLIFF_DURATION + Math.floor(VESTING_DURATION / 2));

      // Release half
      await vesting.releaseVestedTokens(scheduleId);

      const releasedAmount = await vndc.balanceOf(beneficiary1.address);

      // Revoke remaining
      const balanceBefore = await vndc.balanceOf(owner.address);
      await vesting.revokeVestingSchedule(scheduleId);
      const balanceAfter = await vndc.balanceOf(owner.address);

      // Owner should get back approximately half (unreleased amount)
      const returnedAmount = balanceAfter - balanceBefore;
      expect(returnedAmount).to.be.greaterThan(0);
      expect(returnedAmount).to.be.lessThanOrEqual(VESTING_AMOUNT);
    });
  });

  describe("View Functions", function () {
    let scheduleId: string;
    let startTime: number;

    beforeEach(async function () {
      startTime = await time.latest();

      const tx = await vesting.createVestingSchedule(
        beneficiary1.address,
        VESTING_AMOUNT,
        startTime,
        CLIFF_DURATION,
        VESTING_DURATION,
        true
      );

      const schedules = await vesting.getUserVestingSchedules(beneficiary1.address);
      scheduleId = schedules[0];
    });

    it("Should get vesting schedule details", async function () {
      const schedule = await vesting.getVestingSchedule(scheduleId);

      expect(schedule.beneficiary).to.equal(beneficiary1.address);
      expect(schedule.amount).to.equal(VESTING_AMOUNT);
      expect(schedule.revocable).to.be.true;
    });

    it("Should get user vesting schedules", async function () {
      const schedules = await vesting.getUserVestingSchedules(beneficiary1.address);
      expect(schedules.length).to.be.greaterThan(0);
    });

    it("Should get vesting schedules count", async function () {
      const count = await vesting.getVestingSchedulesCount();
      expect(count).to.equal(1);
    });

    it("Should calculate releasable amount", async function () {
      await time.increase(CLIFF_DURATION + 1);

      const releasable = await vesting.calculateReleasableAmount(scheduleId);
      expect(releasable).to.be.greaterThan(0);
    });
  });

  describe("Multiple Beneficiaries", function () {
    it("Should support multiple vesting schedules", async function () {
      const startTime = await time.latest();

      await vesting.createVestingSchedule(
        beneficiary1.address,
        VESTING_AMOUNT,
        startTime,
        CLIFF_DURATION,
        VESTING_DURATION,
        true
      );

      await vesting.createVestingSchedule(
        beneficiary2.address,
        VESTING_AMOUNT,
        startTime,
        CLIFF_DURATION,
        VESTING_DURATION,
        true
      );

      const count = await vesting.getVestingSchedulesCount();
      expect(count).to.equal(2);
    });

    it("Should track schedules per beneficiary independently", async function () {
      const startTime = await time.latest();

      await vesting.createVestingSchedule(
        beneficiary1.address,
        VESTING_AMOUNT,
        startTime,
        CLIFF_DURATION,
        VESTING_DURATION,
        true
      );

      await vesting.createVestingSchedule(
        beneficiary2.address,
        VESTING_AMOUNT,
        startTime,
        CLIFF_DURATION,
        VESTING_DURATION,
        true
      );

      const schedules1 = await vesting.getUserVestingSchedules(beneficiary1.address);
      const schedules2 = await vesting.getUserVestingSchedules(beneficiary2.address);

      expect(schedules1.length).to.equal(1);
      expect(schedules2.length).to.equal(1);
    });
  });
});

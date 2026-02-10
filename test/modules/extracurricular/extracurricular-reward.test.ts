import "@nomicfoundation/hardhat-chai-matchers";
import { expect as chaiExpect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { VNDC, ActivityBadge, ExtracurricularReward } from "../../../typechain";

// Use any to bypass TypeScript type checking for Hardhat-specific matchers
const expect = chaiExpect as any;

describe("Module 004: Extracurricular Rewards", () => {
  let vndc: VNDC;
  let activityBadge: ActivityBadge;
  let extracurricularReward: ExtracurricularReward;

  let owner: SignerWithAddress;
  let teacher: SignerWithAddress;
  let student1: SignerWithAddress;
  let student2: SignerWithAddress;

  const INITIAL_SUPPLY = ethers.parseEther("1000000000"); // 1B tokens
  const ACTIVITY_REWARD = ethers.parseEther("10"); // 10 VNDC per activity

  beforeEach(async () => {
    [owner, teacher, student1, student2] = await ethers.getSigners();

    // Deploy VNDC
    const vndcFactory = await ethers.getContractFactory("VNDC");
    vndc = await vndcFactory.deploy(INITIAL_SUPPLY);
    await vndc.waitForDeployment();

    // Deploy ActivityBadge
    const badgeFactory = await ethers.getContractFactory("ActivityBadge");
    activityBadge = await badgeFactory.deploy();
    await activityBadge.waitForDeployment();

    // Deploy ExtracurricularReward
    const rewardFactory = await ethers.getContractFactory("ExtracurricularReward");
    extracurricularReward = await rewardFactory.deploy(
      await vndc.getAddress(),
      await activityBadge.getAddress()
    );
    await extracurricularReward.waitForDeployment();

    // Transfer VNDC to reward contract
    await vndc.transfer(
      await extracurricularReward.getAddress(),
      ethers.parseEther("1000000") // 1M tokens for rewards
    );

    // Add owner as issuer (for testing)
    await extracurricularReward.addIssuer(owner.address);
    
    // Add teacher as issuer
    await extracurricularReward.addIssuer(teacher.address);
  });

  describe("ActivityBadge", () => {
    it("should create activity badge", async () => {
      const tx = await activityBadge.createBadge("https://api.example.com/activity1.json");
      await tx.wait();

      const exists = await activityBadge.badgeExists(0);
      expect(exists).to.equal(true);
    });

    it("should mint activity badges to student", async () => {
      // Create badge first (as owner)
      const createTx = await activityBadge.createBadge("https://api.example.com/activity1.json");
      await createTx.wait();

      // Mint badge to student (as owner)
      const mintTx = await activityBadge.mint(student1.address, 0, 1);
      await mintTx.wait();

      // Check balance
      const balance = await activityBadge.balanceOf(student1.address, 0);
      expect(balance).to.equal(1n);
    });

    it("should prevent non-owner from creating badges", async () => {
      await expect(
        activityBadge.connect(teacher).createBadge("https://api.example.com/activity1.json")
      ).to.be.revertedWithCustomError(activityBadge, "OwnableUnauthorizedAccount");
    });
  });

  describe("registerActivity", () => {
    it("should register new activity", async () => {
      const badgeTx = await activityBadge.createBadge("https://api.example.com/activity1.json");
      await badgeTx.wait();

      const tx = await extracurricularReward.registerActivity(
        "Volunteer Work",
        "Community service activities",
        ACTIVITY_REWARD,
        0, // badge ID
        5 // max claims per student
      );
      await tx.wait();

      const activities = await extracurricularReward.getActivities();
      expect(activities.length).to.equal(1);
      expect(activities[0]).to.equal(0n);
    });

    it("should store activity details correctly", async () => {
      const badgeTx = await activityBadge.createBadge("https://api.example.com/activity1.json");
      await badgeTx.wait();

      const tx = await extracurricularReward.registerActivity(
        "Debate Tournament",
        "Academic debate competition",
        ethers.parseEther("20"),
        0,
        3
      );
      await tx.wait();

      const activity = await extracurricularReward.getActivity(0);
      expect(activity.name).to.equal("Debate Tournament");
      expect(activity.description).to.equal("Academic debate competition");
      expect(activity.rewardAmount).to.equal(ethers.parseEther("20"));
      expect(activity.maxClaimsPerStudent).to.equal(3n);
      expect(activity.active).to.equal(true);
    });

    it("should prevent non-owner from registering activities", async () => {
      await expect(
        extracurricularReward
          .connect(teacher)
          .registerActivity("Event", "Description", ACTIVITY_REWARD, 0, 5)
      ).to.be.revertedWithCustomError(extracurricularReward, "OwnableUnauthorizedAccount");
    });

    it("should require positive reward amount", async () => {
      try {
        await extracurricularReward.registerActivity(
          "Invalid Activity",
          "Description",
          0, // zero reward
          0,
          5
        );
        expect.fail("Should have reverted");
      } catch (error: any) {
        expect(error.message).to.include("Reward must be positive");
      }
    });
  });

  describe("logActivity", () => {
    beforeEach(async () => {
      const badgeTx = await activityBadge.createBadge("https://api.example.com/activity1.json");
      await badgeTx.wait();

      const actTx = await extracurricularReward.registerActivity(
        "Volunteer Work",
        "Community service",
        ACTIVITY_REWARD,
        0,
        5
      );
      await actTx.wait();
    });

    it("should log student activity", async () => {
      const tx = await extracurricularReward
        .connect(teacher)
        .logActivity(student1.address, 0, '{"completed":"yes"}');
      await tx.wait();

      const activities = await extracurricularReward.getStudentActivities(student1.address);
      expect(activities.length).to.equal(1);
    });

    it("should prevent non-issuer from logging", async () => {
      try {
        await extracurricularReward
          .connect(student1)
          .logActivity(student1.address, 0, "{}");
        expect.fail("Should have reverted");
      } catch (error: any) {
        expect(error.message).to.include("Not authorized issuer");
      }
    });

    it("should prevent logging invalid activity", async () => {
      try {
        await extracurricularReward
          .connect(teacher)
          .logActivity(student1.address, 999, "{}");
        expect.fail("Should have reverted");
      } catch (error: any) {
        expect(error.message).to.include("Activity not found");
      }
    });
  });

  describe("claimActivity", () => {
    beforeEach(async () => {
      const badgeTx = await activityBadge.createBadge("https://api.example.com/activity1.json");
      await badgeTx.wait();

      const actTx = await extracurricularReward.registerActivity(
        "Volunteer Work",
        "Community service",
        ACTIVITY_REWARD,
        0,
        5
      );
      await actTx.wait();

      const logTx = await extracurricularReward
        .connect(teacher)
        .logActivity(student1.address, 0, "{}");
      await logTx.wait();
    });

    it("should claim activity reward", async () => {
      const balanceBefore = await vndc.balanceOf(student1.address);

      const claimTx = await extracurricularReward.connect(student1).claimActivity(0);
      await claimTx.wait();

      const balanceAfter = await vndc.balanceOf(student1.address);
      expect(balanceAfter - balanceBefore).to.equal(ACTIVITY_REWARD);
    });

    it("should prevent duplicate claim", async () => {
      await extracurricularReward.connect(student1).claimActivity(0);

      try {
        await extracurricularReward.connect(student1).claimActivity(0);
        expect.fail("Should have reverted");
      } catch (error: any) {
        expect(error.message).to.include("Already claimed");
      }
    });

    it("should prevent non-student from claiming without log", async () => {
      try {
        await extracurricularReward.connect(teacher).claimActivity(0);
        expect.fail("Should have reverted");
      } catch (error: any) {
        expect(error.message).to.include("Not the activity performer");
      }
    });

    it("should enforce max claims per student", async () => {
      // Verify that a student can claim the logged activity
      const balanceBefore = await vndc.balanceOf(student1.address);
      
      // Student1 has one logged activity from beforeEach (record ID 0)
      await extracurricularReward.connect(student1).claimActivity(0);
      
      const balanceAfter = await vndc.balanceOf(student1.address);
      expect(balanceAfter - balanceBefore).to.equal(ACTIVITY_REWARD);
      
      // Verify claim count increased
      const claims = await extracurricularReward.getClaimCount(student1.address, 0);
      expect(claims).to.equal(1n);
    });
  });

  // Các describe còn lại giữ nguyên nhưng thay try-catch bằng expect.reverted
  describe("issuer management", () => {
    it("should add issuer", async () => {
      await extracurricularReward.addIssuer(student1.address);
      const isIssuer = await extracurricularReward.isIssuer(student1.address);
      expect(isIssuer).to.equal(true);
    });

    it("should remove issuer", async () => {
      await extracurricularReward.addIssuer(student1.address);
      await extracurricularReward.removeIssuer(student1.address);
      const isIssuer = await extracurricularReward.isIssuer(student1.address);
      expect(isIssuer).to.equal(false);
    });

    it("should prevent non-owner from adding issuer", async () => {
      await expect(
        extracurricularReward.connect(teacher).addIssuer(student1.address)
      ).to.be.revertedWithCustomError(extracurricularReward, "OwnableUnauthorizedAccount");
    });
  });

  describe("activity deactivation", () => {
    beforeEach(async () => {
      await activityBadge.createBadge("https://api.example.com/activity1.json");
      await extracurricularReward.registerActivity(
        "Volunteer Work",
        "Community service",
        ACTIVITY_REWARD,
        0,
        5
      );
    });

    it("should deactivate activity", async () => {
      await extracurricularReward.deactivateActivity(0);
      const activity = await extracurricularReward.getActivity(0);
      expect(activity.active).to.equal(false);
    });

    it("should prevent logging deactivated activity", async () => {
      await extracurricularReward.deactivateActivity(0);

      try {
        await extracurricularReward.connect(teacher).logActivity(student1.address, 0, "{}");
        expect.fail("Should have reverted");
      } catch (error: any) {
        expect(error.message).to.include("Activity not active");
      }
    });
  });

  describe("pause/unpause", () => {
    beforeEach(async () => {
      await activityBadge.createBadge("https://api.example.com/activity1.json");
      await extracurricularReward.registerActivity(
        "Volunteer Work",
        "Community service",
        ACTIVITY_REWARD,
        0,
        5
      );
      await extracurricularReward.connect(teacher).logActivity(student1.address, 0, "{}");
    });

    it("should pause activity claiming", async () => {
      await extracurricularReward.pause();

      await expect(
        extracurricularReward.connect(student1).claimActivity(0)
      ).to.be.revertedWithCustomError(extracurricularReward, "EnforcedPause");
    });

    it("should unpause activity claiming", async () => {
      await extracurricularReward.pause();
      await extracurricularReward.unpause();

      // Should not revert after unpause
      const claimTx = await extracurricularReward.connect(student1).claimActivity(0);
      expect(claimTx).not.to.be.null;
    });
  });

  describe("query functions", () => {
    beforeEach(async () => {
      await activityBadge.createBadge("https://api.example.com/activity1.json");
      await extracurricularReward.registerActivity(
        "Volunteer Work",
        "Community service",
        ACTIVITY_REWARD,
        0,
        5
      );
      await extracurricularReward.connect(teacher).logActivity(student1.address, 0, "{}");
    });

    it("should get all activities", async () => {
      const activities = await extracurricularReward.getActivities();
      expect(activities.length).to.equal(1);
    });

    it("should get student activities", async () => {
      const activities = await extracurricularReward.getStudentActivities(student1.address);
      expect(activities.length).to.equal(1);
    });

    it("should get activity details", async () => {
      const activity = await extracurricularReward.getActivity(0);
      expect(activity.name).to.equal("Volunteer Work");
    });

    it("should get claim count", async () => {
      let claims = await extracurricularReward.getClaimCount(student1.address, 0);
      expect(claims).to.equal(0n);

      await extracurricularReward.connect(student1).claimActivity(0);

      claims = await extracurricularReward.getClaimCount(student1.address, 0);
      expect(claims).to.equal(1n);
    });

    it("should get completed activities", async () => {
      let completed = await extracurricularReward.getCompletedActivities(student1.address);
      expect(completed.length).to.equal(0);

      await extracurricularReward.connect(student1).claimActivity(0);

      completed = await extracurricularReward.getCompletedActivities(student1.address);
      expect(completed.length).to.equal(1);
    });
  });
});
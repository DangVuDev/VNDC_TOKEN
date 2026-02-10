import { expect as chaiExpect } from "chai";
import { ethers } from "hardhat";
import { VNDCRegistry, Roles } from "../../../typechain";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

// Use any to bypass TypeScript type checking for Hardhat-specific matchers
const expect = chaiExpect as any;

describe("VNDCRegistry Simple Tests", () => {
  let registry: VNDCRegistry;
  let owner: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;

  const ADMIN_ROLE = ethers.id("ADMIN_ROLE");
  const TEACHER_ROLE = ethers.id("TEACHER_ROLE");
  const STUDENT_ROLE = ethers.id("STUDENT_ROLE");
  const MERCHANT_ROLE = ethers.id("MERCHANT_ROLE");

  beforeEach(async () => {
    [owner, user1, user2] = await ethers.getSigners();
    const Registry_Factory = await ethers.getContractFactory("VNDCRegistry");
    registry = await Registry_Factory.deploy();
    await registry.waitForDeployment();
  });

  describe("User Registration", () => {
    it("should register a new user", async () => {
      await registry.registerUser(user1.address, "User One", STUDENT_ROLE);
      const profile = await registry.getUserProfile(user1.address);
      expect(profile.userAddress).to.equal(user1.address);
      expect(profile.name).to.equal("User One");
      expect(profile.role).to.equal(STUDENT_ROLE);
      expect(profile.exists).to.be.true;
    });

    it("should not allow duplicate registration", async () => {
      await registry.registerUser(user1.address, "User One", STUDENT_ROLE);
      try {
        await registry.registerUser(user1.address, "User One Copy", TEACHER_ROLE);
        expect.fail("Should have reverted");
      } catch (e: any) {
        expect(e.message).to.include("already registered");
      }
    });

    it("should not allow non-owner to register users", async () => {
      try {
        await registry.connect(user1).registerUser(user2.address, "User Two", STUDENT_ROLE);
        expect.fail("Should have reverted");
      } catch (e: any) {
        expect(e.message).to.include("Ownable");
      }
    });

    it("should require valid address", async () => {
      try {
        await registry.registerUser(ethers.ZeroAddress, "Invalid", STUDENT_ROLE);
        expect.fail("Should have reverted");
      } catch (e: any) {
        expect(e.message).to.include("Invalid address");
      }
    });

    it("should require non-empty name", async () => {
      try {
        await registry.registerUser(user1.address, "", STUDENT_ROLE);
        expect.fail("Should have reverted");
      } catch (e: any) {
        expect(e.message).to.include("Name cannot be empty");
      }
    });
  });

  describe("Profile Updates", () => {
    beforeEach(async () => {
      await registry.registerUser(user1.address, "User One", STUDENT_ROLE);
    });

    it("should allow user to update their own profile", async () => {
      await registry.connect(user1).updateProfile(user1.address, "New Name", "ipfs://new");
      const profile = await registry.getUserProfile(user1.address);
      expect(profile.name).to.equal("New Name");
      expect(profile.metadataUri).to.equal("ipfs://new");
    });

    it("should allow owner to update any profile", async () => {
      await registry.updateProfile(user1.address, "Owner Updated", "ipfs://owner");
      const profile = await registry.getUserProfile(user1.address);
      expect(profile.name).to.equal("Owner Updated");
    });

    it("should preserve registered timestamp", async () => {
      const oldProfile = await registry.getUserProfile(user1.address);
      await registry.updateProfile(user1.address, "Updated Name", "ipfs://new");
      const newProfile = await registry.getUserProfile(user1.address);
      expect(newProfile.registeredAt).to.equal(oldProfile.registeredAt);
    });

    it("should not allow non-owner/non-user to update", async () => {
      try {
        await registry.connect(user2).updateProfile(user1.address, "Hacker", "ipfs://hack");
        expect.fail("Should have reverted");
      } catch (e: any) {
        expect(e.message).to.include("Only user or owner");
      }
    });
  });

  describe("Role Management", () => {
    beforeEach(async () => {
      await registry.registerUser(user1.address, "User One", STUDENT_ROLE);
    });

    it("should change user role", async () => {
      await registry.changeUserRole(user1.address, TEACHER_ROLE);
      const profile = await registry.getUserProfile(user1.address);
      expect(profile.role).to.equal(TEACHER_ROLE);
    });

    it("should get users by role", async () => {
      await registry.registerUser(user2.address, "User Two", STUDENT_ROLE);
      const students = await registry.getUsersByRole(STUDENT_ROLE);
      expect(students.length).to.equal(2);
      expect(students).to.include(user1.address);
      expect(students).to.include(user2.address);
    });

    it("should get user role", async () => {
      const role = await registry.getUserRole(user1.address);
      expect(role).to.equal(STUDENT_ROLE);
    });

    it("should get role member count", async () => {
      await registry.registerUser(user2.address, "User Two", STUDENT_ROLE);
      const count = await registry.getRoleMemberCount(STUDENT_ROLE);
      expect(count).to.equal(2n);
    });
  });

  describe("Queries", () => {
    beforeEach(async () => {
      await registry.registerUser(user1.address, "User One", STUDENT_ROLE);
      await registry.registerUser(user2.address, "User Two", TEACHER_ROLE);
    });

    it("should check user exists", async () => {
      expect(await registry.userExists(user1.address)).to.be.true;
      const randomAddress = ethers.Wallet.createRandom().address;
      expect(await registry.userExists(randomAddress)).to.be.false;
    });

    it("should get total users", async () => {
      const total = await registry.getTotalUsers();
      expect(total).to.equal(2n);
    });

    it("should get all users", async () => {
      const allUsers = await registry.getAllUsers();
      expect(allUsers.length).to.equal(2);
      expect(allUsers).to.include(user1.address);
      expect(allUsers).to.include(user2.address);
    });

    it("should get registry stats", async () => {
      const stats = await registry.getRegistryStats();
      expect(stats.totalUsers).to.equal(2n);
    });

    it("should get user name", async () => {
      const name = await registry.getUserName(user1.address);
      expect(name).to.equal("User One");
    });
  });

  describe("Batch Operations", () => {
    it("should register multiple users in batch", async () => {
      const users = [user1.address, user2.address];
      const names = ["User One", "User Two"];
      const roles = [STUDENT_ROLE, TEACHER_ROLE];

      await registry.registerUsersBatch(users, names, roles);

      expect(await registry.userExists(user1.address)).to.be.true;
      expect(await registry.userExists(user2.address)).to.be.true;
      expect(await registry.getTotalUsers()).to.equal(2n);
    });

    it("should skip already registered users in batch", async () => {
      // Register user1 first
      await registry.registerUser(user1.address, "User One", STUDENT_ROLE);

      // Try to batch register both (user1 should be skipped)
      const users = [user1.address, user2.address];
      const names = ["User One", "User Two"];
      const roles = [TEACHER_ROLE, TEACHER_ROLE];

      await registry.registerUsersBatch(users, names, roles);

      // Only 2 users total (user1 wasn't re-registered)
      expect(await registry.getTotalUsers()).to.equal(2n);
      // user1 should still have original role
      expect(await registry.getUserRole(user1.address)).to.equal(STUDENT_ROLE);
    });

    it("should fail on array length mismatch", async () => {
      const users = [user1.address];
      const names = ["User One", "User Two"]; // Different length
      const roles = [STUDENT_ROLE];

      try {
        await registry.registerUsersBatch(users, names, roles);
        expect.fail("Should have reverted");
      } catch (e: any) {
        expect(e.message).to.include("lengths mismatch");
      }
    });

    it("should fail on empty batch", async () => {
      try {
        await registry.registerUsersBatch([], [], []);
        expect.fail("Should have reverted");
      } catch (e: any) {
        expect(e.message).to.include("Empty array");
      }
    });

    it("should fail on batch too large", async () => {
      const users = [];
      const names = [];
      const roles = [];
      for (let i = 0; i < 101; i++) {
        users.push(ethers.Wallet.createRandom().address);
        names.push(`User ${i}`);
        roles.push(STUDENT_ROLE);
      }

      try {
        await registry.registerUsersBatch(users, names, roles);
        expect.fail("Should have reverted");
      } catch (e: any) {
        expect(e.message).to.include("Too many");
      }
    });
  });
});

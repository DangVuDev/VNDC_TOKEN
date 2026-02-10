import { expect as chaiExpect } from "chai";
import "@nomicfoundation/hardhat-chai-matchers";
import { ethers } from "hardhat";
import { VNDCRegistry } from "../../../typechain";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

// Use any to bypass TypeScript type checking for Hardhat-specific matchers
const expect = chaiExpect as any;

describe("VNDCRegistry Tests", () => {
  let registry: VNDCRegistry;
  let owner: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  let user3: SignerWithAddress;
  let addrs: SignerWithAddress[];

  const STUDENT_ROLE = ethers.id("STUDENT_ROLE");
  const TEACHER_ROLE = ethers.id("TEACHER_ROLE");
  const ADMIN_ROLE = ethers.id("ADMIN_ROLE");

  before(async () => {
    [owner, user1, user2, user3, ...addrs] = await ethers.getSigners();
  });

  beforeEach(async () => {
    const Registry_Factory = await ethers.getContractFactory(
      "VNDCRegistry"
    );
    registry = await Registry_Factory.deploy();
    await registry.waitForDeployment();
  });

  describe("User Registration", () => {
    it("should register a user", async () => {
      await expect(
        registry.registerUser(user1.address, "Alice", STUDENT_ROLE)
      )
        .to.emit(registry, "UserRegistered")
        .withArgs(user1.address, STUDENT_ROLE);

      const profile = await registry.getUserProfile(user1.address);
      expect(profile.userAddress).to.equal(user1.address);
      expect(profile.name).to.equal("Alice");
      expect(profile.role).to.equal(STUDENT_ROLE);
      expect(profile.exists).to.be.true;
    });

    it("should fail if user already registered", async () => {
      await registry.registerUser(user1.address, "Alice", STUDENT_ROLE);

      await expect(
        registry.registerUser(user1.address, "Bob", STUDENT_ROLE)
      ).to.be.revertedWith("Registry: User already registered");
    });

    it("should fail if invalid address", async () => {
      await expect(
        registry.registerUser(ethers.ZeroAddress, "Alice", STUDENT_ROLE)
      ).to.be.revertedWith("Registry: Invalid address");
    });

    it("should fail if empty name", async () => {
      await expect(
        registry.registerUser(user1.address, "", STUDENT_ROLE)
      ).to.be.revertedWith("Registry: Name cannot be empty");
    });

    it("should fail if invalid role", async () => {
      await expect(
        registry.registerUser(user1.address, "Alice", ethers.ZeroHash)
      ).to.be.revertedWith("Registry: Role cannot be empty");
    });

    it("should fail if not owner", async () => {
      await expect(
        registry
          .connect(user1)
          .registerUser(user2.address, "Bob", STUDENT_ROLE)
      ).to.be.revertedWithCustomError(
        registry,
        "OwnableUnauthorizedAccount"
      );
    });
  });

  describe("Profile Updates", () => {
    beforeEach(async () => {
      await registry.registerUser(user1.address, "Alice", STUDENT_ROLE);
    });

    it("should update profile by owner", async () => {
      await expect(
        registry.updateProfile(user1.address, "Alice Updated", "ipfs://meta1")
      )
        .to.emit(registry, "UserUpdated")
        .withArgs(user1.address, "Alice Updated");

      const profile = await registry.getUserProfile(user1.address);
      expect(profile.name).to.equal("Alice Updated");
      expect(profile.metadataUri).to.equal("ipfs://meta1");
    });

    it("should allow user to update their own profile", async () => {
      await expect(
        registry
          .connect(user1)
          .updateProfile(user1.address, "Alice Self", "ipfs://meta2")
      )
        .to.emit(registry, "UserUpdated");

      const profile = await registry.getUserProfile(user1.address);
      expect(profile.name).to.equal("Alice Self");
    });

    it("should fail if user does not exist", async () => {
      await expect(
        registry.updateProfile(user2.address, "Bob", "ipfs://meta")
      ).to.be.revertedWith("Registry: User does not exist");
    });

    it("should fail if empty name", async () => {
      await expect(
        registry.updateProfile(user1.address, "", "ipfs://meta")
      ).to.be.revertedWith("Registry: Name cannot be empty");
    });

    it("should fail if unauthorized user updates", async () => {
      await expect(
        registry.connect(user2).updateProfile(user1.address, "Hacker", "ipfs://")
      ).to.be.revertedWith("Registry: Only user or owner can update");
    });
  });

  describe("Profile Queries", () => {
    beforeEach(async () => {
      await registry.registerUser(user1.address, "Alice", STUDENT_ROLE);
      await registry.registerUser(user2.address, "Bob", TEACHER_ROLE);
    });

    it("should get user profile", async () => {
      const profile = await registry.getUserProfile(user1.address);

      expect(profile.userAddress).to.equal(user1.address);
      expect(profile.name).to.equal("Alice");
      expect(profile.role).to.equal(STUDENT_ROLE);
    });

    it("should check if user exists", async () => {
      expect(await registry.userExists(user1.address)).to.be.true;
      expect(await registry.userExists(user3.address)).to.be.false;
    });

    it("should get user role", async () => {
      const role = await registry.getUserRole(user1.address);
      expect(role).to.equal(STUDENT_ROLE);
    });

    it("should get user name", async () => {
      const name = await registry.getUserName(user1.address);
      expect(name).to.equal("Alice");
    });

    it("should get user registration timestamp", async () => {
      const timestamp = await registry.getUserRegisteredAt(user1.address);
      expect(timestamp).to.be.greaterThan(0);
    });

    it("should fail to get profile of non-existent user", async () => {
      await expect(
        registry.getUserProfile(user3.address)
      ).to.be.revertedWith("Registry: User does not exist");
    });
  });

  describe("Role Management", () => {
    beforeEach(async () => {
      await registry.registerUser(user1.address, "Alice", STUDENT_ROLE);
    });

    it("should change user role", async () => {
      await expect(registry.changeUserRole(user1.address, TEACHER_ROLE))
        .to.emit(registry, "UserRoleChanged")
        .withArgs(user1.address, STUDENT_ROLE, TEACHER_ROLE);

      const role = await registry.getUserRole(user1.address);
      expect(role).to.equal(TEACHER_ROLE);
    });

    it("should get users by role", async () => {
      await registry.registerUser(user2.address, "Bob", STUDENT_ROLE);

      const students = await registry.getUsersByRole(STUDENT_ROLE);

      expect(students.length).to.equal(2);
      expect(students).to.include(user1.address);
      expect(students).to.include(user2.address);
    });

    it("should get role member count", async () => {
      await registry.registerUser(user2.address, "Bob", STUDENT_ROLE);

      const count = await registry.getRoleMemberCount(STUDENT_ROLE);
      expect(count).to.equal(2);
    });

    it("should fail to change role of non-existent user", async () => {
      await expect(
        registry.changeUserRole(user3.address, TEACHER_ROLE)
      ).to.be.revertedWith("Registry: User does not exist");
    });
  });

  describe("User Statistics", () => {
    beforeEach(async () => {
      await registry.registerUser(user1.address, "Alice", STUDENT_ROLE);
      await registry.registerUser(user2.address, "Bob", TEACHER_ROLE);
      await registry.registerUser(user3.address, "Charlie", ADMIN_ROLE);
    });

    it("should get total users", async () => {
      const total = await registry.getTotalUsers();
      expect(total).to.equal(3);
    });

    it("should get all users", async () => {
      const users = await registry.getAllUsers();

      expect(users.length).to.equal(3);
      expect(users).to.include(user1.address);
      expect(users).to.include(user2.address);
      expect(users).to.include(user3.address);
    });

    it("should get user at index", async () => {
      const user = await registry.getUserAtIndex(0);
      expect(user).to.equal(user1.address);
    });

    it("should get registry stats", async () => {
      const [total, admins, teachers, students] =
        await registry.getRegistryStats();

      expect(total).to.equal(3);
      expect(admins).to.equal(1);
      expect(teachers).to.equal(1);
      expect(students).to.equal(1);
    });

    it("should fail to get user at invalid index", async () => {
      await expect(registry.getUserAtIndex(10)).to.be.revertedWith(
        "Registry: Index out of bounds"
      );
    });
  });

  describe("Batch Operations", () => {
    it("should register multiple users", async () => {
      const users = [user1.address, user2.address, user3.address];
      const names = ["Alice", "Bob", "Charlie"];
      const roles = [STUDENT_ROLE, STUDENT_ROLE, TEACHER_ROLE];

      await registry.registerUsersBatch(users, names, roles);

      expect(await registry.getTotalUsers()).to.equal(3);
      expect(await registry.getUserName(user1.address)).to.equal("Alice");
      expect(await registry.getUserName(user2.address)).to.equal("Bob");
      expect(await registry.getUserRole(user3.address)).to.equal(TEACHER_ROLE);
    });

    it("should fail if array lengths mismatch", async () => {
      const users = [user1.address, user2.address];
      const names = ["Alice"];
      const roles = [STUDENT_ROLE];

      await expect(
        registry.registerUsersBatch(users, names, roles)
      ).to.be.revertedWith("Registry: Array lengths mismatch");
    });

    it("should fail if empty array", async () => {
      await expect(
        registry.registerUsersBatch([], [], [])
      ).to.be.revertedWith("Registry: Empty array");
    });

    it("should fail if too many users", async () => {
      const users = new Array(101).fill(user1.address);
      const names = new Array(101).fill("User");
      const roles = new Array(101).fill(STUDENT_ROLE);

      await expect(
        registry.registerUsersBatch(users, names, roles)
      ).to.be.revertedWith("Registry: Too many users");
    });
  });

  describe("Edge Cases", () => {
    it("should handle duplicate registration in batch", async () => {
      await registry.registerUser(user1.address, "Alice", STUDENT_ROLE);

      const users = [user1.address, user2.address];
      const names = ["Alice", "Bob"];
      const roles = [STUDENT_ROLE, STUDENT_ROLE];

      // Should not fail, just skip already registered user
      await registry.registerUsersBatch(users, names, roles);

      expect(await registry.getTotalUsers()).to.equal(2);
    });

    it("should preserve registration timestamp", async () => {
      const blockBefore = await ethers.provider.getBlockNumber();
      await registry.registerUser(user1.address, "Alice", STUDENT_ROLE);
      const blockAfter = await ethers.provider.getBlockNumber();

      const timestamp = await registry.getUserRegisteredAt(user1.address);
      const block = await ethers.provider.getBlock(blockBefore);

      expect(timestamp).to.be.gte(block!.timestamp);
    });

    it("should maintain role consistency after updates", async () => {
      await registry.registerUser(user1.address, "Alice", STUDENT_ROLE);
      await registry.changeUserRole(user1.address, TEACHER_ROLE);
      await registry.changeUserRole(user1.address, STUDENT_ROLE);

      const students = await registry.getUsersByRole(STUDENT_ROLE);
      expect(students).to.include(user1.address);

      const teachers = await registry.getUsersByRole(TEACHER_ROLE);
      expect(teachers).to.not.include(user1.address);
    });
  });
});

import { expect as chaiExpect } from "chai";
import { ethers } from "hardhat";
import { AccessControl } from "../../../typechain";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

// Use any to bypass TypeScript type checking for Hardhat-specific matchers
const expect = chaiExpect as any;

describe("AccessControl Simple Tests", () => {
  let acl: AccessControl;
  let owner: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;

  const ADMIN_ROLE = ethers.id("ADMIN_ROLE");
  const TEACHER_ROLE = ethers.id("TEACHER_ROLE");
  const STUDENT_ROLE = ethers.id("STUDENT_ROLE");
  const MERCHANT_ROLE = ethers.id("MERCHANT_ROLE");
  const ISSUER_ROLE = ethers.id("ISSUER_ROLE");
  const MINTER_ROLE = ethers.id("MINTER_ROLE");

  beforeEach(async () => {
    [owner, user1, user2] = await ethers.getSigners();
    const ACL_Factory = await ethers.getContractFactory("AccessControl");
    acl = await ACL_Factory.deploy();
    await acl.waitForDeployment();
  });

  describe("Initialization", () => {
    it("should initialize with owner as admin", async () => {
      expect(await acl.hasRole(ADMIN_ROLE, owner.address)).to.be.true;
    });

    it("should allow owner to be authorized", async () => {
      expect(await acl.isAuthorized(owner.address)).to.be.true;
    });
  });

  describe("Grant Role", () => {
    it("should grant role to user", async () => {
      await acl.grantRole(STUDENT_ROLE, user1.address);
      expect(await acl.hasRole(STUDENT_ROLE, user1.address)).to.be.true;
    });

    it("should not grant role twice", async () => {
      await acl.grantRole(STUDENT_ROLE, user1.address);
      // Granting again should be idempotent (no error, but role count stays same)
      await acl.grantRole(STUDENT_ROLE, user1.address);
      const roles = await acl.getRoles(user1.address);
      expect(roles.filter((r: any) => r === STUDENT_ROLE).length).to.equal(1);
    });

    it("should only allow owner to grant roles", async () => {
      try {
        await acl.connect(user1).grantRole(STUDENT_ROLE, user2.address);
        expect.fail("Should have reverted");
      } catch (e: any) {
        expect(e.message).to.include("Ownable");
      }
    });

    it("should support multiple roles per account", async () => {
      await acl.grantRole(STUDENT_ROLE, user1.address);
      await acl.grantRole(TEACHER_ROLE, user1.address);
      const roles = await acl.getRoles(user1.address);
      expect(roles.length).to.equal(2);
      expect(roles).to.include(STUDENT_ROLE);
      expect(roles).to.include(TEACHER_ROLE);
    });
  });

  describe("Revoke Role", () => {
    beforeEach(async () => {
      await acl.grantRole(STUDENT_ROLE, user1.address);
      await acl.grantRole(TEACHER_ROLE, user1.address);
    });

    it("should revoke role from user", async () => {
      await acl.revokeRole(STUDENT_ROLE, user1.address);
      expect(await acl.hasRole(STUDENT_ROLE, user1.address)).to.be.false;
    });

    it("should keep other roles when revoking one", async () => {
      await acl.revokeRole(STUDENT_ROLE, user1.address);
      expect(await acl.hasRole(TEACHER_ROLE, user1.address)).to.be.true;
    });

    it("should only allow owner to revoke roles", async () => {
      try {
        await acl.connect(user1).revokeRole(STUDENT_ROLE, user1.address);
        expect.fail("Should have reverted");
      } catch (e: any) {
        expect(e.message).to.include("Ownable");
      }
    });

    it("should handle revoking non-existent role gracefully", async () => {
      // Revoking a role user doesn't have should not fail
      await acl.revokeRole(MERCHANT_ROLE, user1.address);
      expect(await acl.hasRole(MERCHANT_ROLE, user1.address)).to.be.false;
    });
  });

  describe("Role Queries", () => {
    beforeEach(async () => {
      await acl.grantRole(STUDENT_ROLE, user1.address);
      await acl.grantRole(TEACHER_ROLE, user1.address);
      await acl.grantRole(MERCHANT_ROLE, user2.address);
    });

    it("should check if account has role", async () => {
      expect(await acl.hasRole(STUDENT_ROLE, user1.address)).to.be.true;
      expect(await acl.hasRole(STUDENT_ROLE, user2.address)).to.be.false;
    });

    it("should return all roles for account", async () => {
      const roles = await acl.getRoles(user1.address);
      expect(roles.length).to.equal(2);
      expect(roles).to.include(STUDENT_ROLE);
      expect(roles).to.include(TEACHER_ROLE);
    });

    it("should check if account is authorized", async () => {
      expect(await acl.isAuthorized(user1.address)).to.be.true;
      expect(await acl.isAuthorized(user2.address)).to.be.true;
      const randomAddress = ethers.Wallet.createRandom().address;
      expect(await acl.isAuthorized(randomAddress)).to.be.false;
    });

    it("should return role count", async () => {
      const count = await acl.getRoleCount(user1.address);
      expect(count).to.equal(2n);
    });

    it("should check convenience role functions", async () => {
      await acl.grantRole(ADMIN_ROLE, user1.address);
      expect(await acl.isAdmin(user1.address)).to.be.true;
      expect(await acl.isTeacher(user1.address)).to.be.true;
      expect(await acl.isStudent(user1.address)).to.be.true;
      expect(await acl.isMerchant(user1.address)).to.be.false;
    });
  });

  describe("Batch Operations", () => {
    it("should grant roles in batch", async () => {
      const accounts = [user1.address, user2.address];
      await acl.grantRoleBatch(STUDENT_ROLE, accounts);
      expect(await acl.hasRole(STUDENT_ROLE, user1.address)).to.be.true;
      expect(await acl.hasRole(STUDENT_ROLE, user2.address)).to.be.true;
    });

    it("should revoke roles in batch", async () => {
      const accounts = [user1.address, user2.address];
      await acl.grantRoleBatch(STUDENT_ROLE, accounts);
      await acl.revokeRoleBatch(STUDENT_ROLE, accounts);
      expect(await acl.hasRole(STUDENT_ROLE, user1.address)).to.be.false;
      expect(await acl.hasRole(STUDENT_ROLE, user2.address)).to.be.false;
    });

    it("should handle batch size limits", async () => {
      const accounts = [];
      for (let i = 0; i < 101; i++) {
        accounts.push(ethers.Wallet.createRandom().address);
      }
      try {
        await acl.grantRoleBatch(STUDENT_ROLE, accounts);
        expect.fail("Should have reverted");
      } catch (e: any) {
        expect(e.message).to.include("Too many");
      }
    });

    it("should skip already-granted roles in batch", async () => {
      // Grant role individually first
      await acl.grantRole(STUDENT_ROLE, user1.address);
      // Then grant in batch
      const accounts = [user1.address, user2.address];
      await acl.grantRoleBatch(STUDENT_ROLE, accounts);
      // Both should have the role, no duplicates
      const roles = await acl.getRoles(user1.address);
      const studentCount = roles.filter((r: any) => r === STUDENT_ROLE).length;
      expect(studentCount).to.equal(1);
    });
  });

  describe("Statistics", () => {
    beforeEach(async () => {
      await acl.grantRole(ADMIN_ROLE, user1.address);
      await acl.grantRole(TEACHER_ROLE, user1.address);
      await acl.grantRole(STUDENT_ROLE, user2.address);
    });

    it("should return access stats", async () => {
      const stats = await acl.getAccessStats();
      // Should have counts for different roles
      expect(stats).to.exist;
    });

    it("should check if role has members", async () => {
      expect(await acl.roleExists(STUDENT_ROLE)).to.be.true;
      expect(await acl.roleExists(MERCHANT_ROLE)).to.be.false;
    });
  });

  describe("Multiple Cycles", () => {
    it("should handle grant/revoke cycles", async () => {
      // Grant, revoke, grant again
      await acl.grantRole(STUDENT_ROLE, user1.address);
      expect(await acl.hasRole(STUDENT_ROLE, user1.address)).to.be.true;

      await acl.revokeRole(STUDENT_ROLE, user1.address);
      expect(await acl.hasRole(STUDENT_ROLE, user1.address)).to.be.false;

      await acl.grantRole(STUDENT_ROLE, user1.address);
      expect(await acl.hasRole(STUDENT_ROLE, user1.address)).to.be.true;
    });

    it("should maintain role count through cycles", async () => {
      const accounts = [user1.address, user2.address];
      await acl.grantRoleBatch(STUDENT_ROLE, accounts);
      let count = await acl.getRoleCount(user1.address);
      expect(count).to.equal(1n);

      await acl.revokeRoleBatch(STUDENT_ROLE, accounts);
      count = await acl.getRoleCount(user1.address);
      expect(count).to.equal(0n);
    });
  });
});

import { expect as chaiExpect } from "chai";
import "@nomicfoundation/hardhat-chai-matchers";
import { ethers } from "hardhat";
import { AccessControl } from "../../../typechain";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

// Use any to bypass TypeScript type checking for Hardhat-specific matchers
const expect = chaiExpect as any;

describe("AccessControl Tests", () => {
  let acl: AccessControl;
  let owner: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  let user3: SignerWithAddress;
  let addrs: SignerWithAddress[];

  const STUDENT_ROLE = ethers.id("STUDENT_ROLE");
  const TEACHER_ROLE = ethers.id("TEACHER_ROLE");
  const ADMIN_ROLE = ethers.id("ADMIN_ROLE");
  const MERCHANT_ROLE = ethers.id("MERCHANT_ROLE");

  before(async () => {
    [owner, user1, user2, user3, ...addrs] = await ethers.getSigners();
  });

  beforeEach(async () => {
    const AccessControl_Factory = await ethers.getContractFactory(
      "AccessControl"
    );
    acl = await AccessControl_Factory.deploy();
    await acl.waitForDeployment();
  });

  describe("Initialization", () => {
    it("should give owner admin role", async () => {
      expect(await acl.hasRole(ADMIN_ROLE, owner.address)).to.be.true;
    });

    it("should owner be authorized", async () => {
      expect(await acl.isAuthorized(owner.address)).to.be.true;
    });
  });

  describe("Role Grant", () => {
    it("should grant role to account", async () => {
      const tx = acl.grantRole(STUDENT_ROLE, user1.address);
      await expect(tx)
        .to.emit(acl, "RoleAssigned")
        .withArgs(STUDENT_ROLE, user1.address, owner.address);

      expect(await acl.hasRole(STUDENT_ROLE, user1.address)).to.be.true;
    });

    it("should not grant same role twice", async () => {
      await acl.grantRole(STUDENT_ROLE, user1.address);

      const tx = acl.grantRole(STUDENT_ROLE, user1.address);
      // Should not emit event second time
      await expect(tx).to.not.emit(acl, "RoleAssigned");

      expect(await acl.hasRole(STUDENT_ROLE, user1.address)).to.be.true;
    });

    it("should fail to grant role if not owner", async () => {
      await expect(
        acl.connect(user1).grantRole(STUDENT_ROLE, user2.address)
      ).to.be.revertedWithCustomError(acl, "OwnableUnauthorizedAccount");
    });

    it("should fail to grant to zero address", async () => {
      await expect(
        acl.grantRole(STUDENT_ROLE, ethers.ZeroAddress)
      ).to.be.revertedWith("AccessControl: Invalid address");
    });

    it("should fail to grant invalid role", async () => {
      await expect(
        acl.grantRole(ethers.ZeroHash, user1.address)
      ).to.be.revertedWith("AccessControl: Invalid role");
    });
  });

  describe("Role Revoke", () => {
    beforeEach(async () => {
      await acl.grantRole(STUDENT_ROLE, user1.address);
    });

    it("should revoke role from account", async () => {
      const tx = acl.revokeRole(STUDENT_ROLE, user1.address);
      await expect(tx)
        .to.emit(acl, "RoleRemoved")
        .withArgs(STUDENT_ROLE, user1.address, owner.address);

      expect(await acl.hasRole(STUDENT_ROLE, user1.address)).to.be.false;
    });

    it("should fail to revoke non-existent role", async () => {
      await expect(
        acl.revokeRole(TEACHER_ROLE, user1.address)
      ).to.be.revertedWith("AccessControl: Account doesn't have role");
    });

    it("should fail if not owner", async () => {
      await expect(
        acl.connect(user2).revokeRole(STUDENT_ROLE, user1.address)
      ).to.be.revertedWithCustomError(acl, "OwnableUnauthorizedAccount");
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
      expect(await acl.hasRole(TEACHER_ROLE, user1.address)).to.be.true;
      expect(await acl.hasRole(MERCHANT_ROLE, user1.address)).to.be.false;
    });

    it("should check if account is authorized", async () => {
      expect(await acl.isAuthorized(user1.address)).to.be.true;
      expect(await acl.isAuthorized(user3.address)).to.be.false;
    });

    it("should get account roles", async () => {
      const roles = await acl.getRoles(user1.address);

      expect(roles.length).to.equal(2);
      expect(roles).to.include(STUDENT_ROLE);
      expect(roles).to.include(TEACHER_ROLE);
    });

    it("should get role count", async () => {
      const count = await acl.getRoleCount(user1.address);
      expect(count).to.equal(2);
    });

    it("should get role members", async () => {
      const members = await acl.getRoleMembers(STUDENT_ROLE);

      expect(members.length).to.equal(1);
      expect(members[0]).to.equal(user1.address);
    });

    it("should get role member count", async () => {
      const count = await acl.getRoleMemberCount(STUDENT_ROLE);
      expect(count).to.equal(1);
    });
  });

  describe("Convenience Checks", () => {
    beforeEach(async () => {
      await acl.grantRole(STUDENT_ROLE, user1.address);
      await acl.grantRole(TEACHER_ROLE, user2.address);
      await acl.grantRole(MERCHANT_ROLE, user3.address);
    });

    it("should check if admin", async () => {
      expect(await acl.isAdmin(owner.address)).to.be.true;
      expect(await acl.isAdmin(user1.address)).to.be.false;
    });

    it("should check if student", async () => {
      expect(await acl.isStudent(user1.address)).to.be.true;
      expect(await acl.isStudent(user2.address)).to.be.false;
    });

    it("should check if teacher", async () => {
      expect(await acl.isTeacher(user2.address)).to.be.true;
      expect(await acl.isTeacher(user1.address)).to.be.false;
    });

    it("should check if merchant", async () => {
      expect(await acl.isMerchant(user3.address)).to.be.true;
      expect(await acl.isMerchant(user1.address)).to.be.false;
    });
  });

  describe("Batch Operations", () => {
    it("should grant role to multiple accounts", async () => {
      const accounts = [user1.address, user2.address, user3.address];

      await acl.grantRoleBatch(STUDENT_ROLE, accounts);

      for (const account of accounts) {
        expect(await acl.hasRole(STUDENT_ROLE, account)).to.be.true;
      }
    });

    it("should revoke role from multiple accounts", async () => {
      const accounts = [user1.address, user2.address, user3.address];

      await acl.grantRoleBatch(STUDENT_ROLE, accounts);
      await acl.revokeRoleBatch(STUDENT_ROLE, accounts);

      for (const account of accounts) {
        expect(await acl.hasRole(STUDENT_ROLE, account)).to.be.false;
      }
    });

    it("should fail if empty array", async () => {
      await expect(acl.grantRoleBatch(STUDENT_ROLE, [])).to.be.revertedWith(
        "AccessControl: Empty array"
      );
    });

    it("should fail if too many accounts", async () => {
      const accounts = new Array(101).fill(user1.address);

      await expect(
        acl.grantRoleBatch(STUDENT_ROLE, accounts)
      ).to.be.revertedWith("AccessControl: Too many accounts");
    });

    it("should skip already granted roles in batch", async () => {
      await acl.grantRole(STUDENT_ROLE, user1.address);

      const accounts = [user1.address, user2.address];
      await acl.grantRoleBatch(STUDENT_ROLE, accounts);

      expect(await acl.getRoleMemberCount(STUDENT_ROLE)).to.equal(2);
    });
  });

  describe("Multiple Roles per Account", () => {
    it("should handle multiple roles per account", async () => {
      await acl.grantRole(STUDENT_ROLE, user1.address);
      await acl.grantRole(TEACHER_ROLE, user1.address);
      await acl.grantRole(MERCHANT_ROLE, user1.address);

      const roles = await acl.getRoles(user1.address);
      expect(roles.length).to.equal(3);

      expect(await acl.hasRole(STUDENT_ROLE, user1.address)).to.be.true;
      expect(await acl.hasRole(TEACHER_ROLE, user1.address)).to.be.true;
      expect(await acl.hasRole(MERCHANT_ROLE, user1.address)).to.be.true;
    });

    it("should remove single role while keeping others", async () => {
      await acl.grantRole(STUDENT_ROLE, user1.address);
      await acl.grantRole(TEACHER_ROLE, user1.address);
      await acl.grantRole(MERCHANT_ROLE, user1.address);

      await acl.revokeRole(TEACHER_ROLE, user1.address);

      const roles = await acl.getRoles(user1.address);
      expect(roles.length).to.equal(2);
      expect(roles).to.include(STUDENT_ROLE);
      expect(roles).to.include(MERCHANT_ROLE);
    });
  });

  describe("Access Control Statistics", () => {
    beforeEach(async () => {
      await acl.grantRole(STUDENT_ROLE, user1.address);
      await acl.grantRole(STUDENT_ROLE, user2.address);
      await acl.grantRole(TEACHER_ROLE, user3.address);
    });

    it("should get access stats", async () => {
      const [admins, teachers, students, merchants] =
        await acl.getAccessStats();

      expect(admins).to.equal(1); // owner
      expect(teachers).to.equal(1);
      expect(students).to.equal(2);
      expect(merchants).to.equal(0);
    });

    it("should check if role exists", async () => {
      expect(await acl.roleExists(STUDENT_ROLE)).to.be.true;
      expect(await acl.roleExists(MERCHANT_ROLE)).to.be.false;
    });
  });

  describe("Edge Cases", () => {
    it("should handle role grant and revoke cycles", async () => {
      for (let i = 0; i < 5; i++) {
        await acl.grantRole(STUDENT_ROLE, user1.address);
        expect(await acl.hasRole(STUDENT_ROLE, user1.address)).to.be.true;

        await acl.revokeRole(STUDENT_ROLE, user1.address);
        expect(await acl.hasRole(STUDENT_ROLE, user1.address)).to.be.false;
      }
    });

    it("should maintain correct member count", async () => {
      await acl.grantRole(STUDENT_ROLE, user1.address);
      expect(await acl.getRoleMemberCount(STUDENT_ROLE)).to.equal(1);

      await acl.grantRole(STUDENT_ROLE, user2.address);
      expect(await acl.getRoleMemberCount(STUDENT_ROLE)).to.equal(2);

      await acl.revokeRole(STUDENT_ROLE, user1.address);
      expect(await acl.getRoleMemberCount(STUDENT_ROLE)).to.equal(1);

      await acl.revokeRole(STUDENT_ROLE, user2.address);
      expect(await acl.getRoleMemberCount(STUDENT_ROLE)).to.equal(0);
    });

    it("should handle reordering of role members list", async () => {
      const users = [user1.address, user2.address, user3.address];

      for (const user of users) {
        await acl.grantRole(STUDENT_ROLE, user);
      }

      // Revoke middle member
      await acl.revokeRole(STUDENT_ROLE, user2.address);

      const members = await acl.getRoleMembers(STUDENT_ROLE);
      expect(members.length).to.equal(2);
      expect(members).to.include(user1.address);
      expect(members).to.include(user3.address);
    });
  });
});

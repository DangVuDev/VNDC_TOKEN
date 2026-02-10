import { expect as chaiExpect } from "chai";
import "@nomicfoundation/hardhat-chai-matchers";
import { ethers } from "hardhat";
import { CredentialNFT, CredentialVerification } from "../../../typechain";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

// Use any to bypass TypeScript type checking for Hardhat-specific matchers
const expect = chaiExpect as any;

describe("CredentialVerification Tests", () => {
  let nft: CredentialNFT;
  let verifier: CredentialVerification;
  let owner: SignerWithAddress;
  let issuer: SignerWithAddress;
  let student: SignerWithAddress;
  let student2: SignerWithAddress;
  let unauthorized: SignerWithAddress;

  const TEST_CRED_NAME = "Bachelor of Computer Science";
  const TEST_CRED_LEVEL = "Bachelor";
  const TEST_METADATA = "ipfs://QmBachelorCS123";
  const EXPIRATION_DAYS = 365;

  beforeEach(async () => {
    [owner, issuer, student, student2, unauthorized] = await ethers.getSigners();

    // Deploy NFT contract
    const CredentialNFT_Factory = await ethers.getContractFactory("CredentialNFT");
    nft = await CredentialNFT_Factory.deploy();
    await nft.waitForDeployment();

    // Deploy Verification contract
    const CredentialVerification_Factory = await ethers.getContractFactory(
      "CredentialVerification"
    );
    verifier = await CredentialVerification_Factory.deploy(await nft.getAddress());
    await verifier.waitForDeployment();

    // Grant NFT minting permission to verifier
    // Transfer ownership of NFT to verifier so it can mint
    await nft.transferOwnership(await verifier.getAddress());
  });

  describe("Deployment", () => {
    it("should set correct NFT contract", async () => {
      expect(await verifier.nftContract()).to.equal(await nft.getAddress());
    });

    it("should set deployer as issuer", async () => {
      expect(await verifier.isIssuer(owner.address)).to.be.true;
    });
  });

  describe("Issuer Management", () => {
    it("should add issuer", async () => {
      await verifier.addIssuer(issuer.address);
      expect(await verifier.isIssuer(issuer.address)).to.be.true;
    });

    it("should remove issuer", async () => {
      await verifier.addIssuer(issuer.address);
      await verifier.removeIssuer(issuer.address);
      expect(await verifier.isIssuer(issuer.address)).to.be.false;
    });

    it("should fail to add zero address as issuer", async () => {
      try {
        await verifier.addIssuer(ethers.ZeroAddress);
        expect.fail("Should have reverted");
      } catch (e: any) {
        expect(e.message).to.include("Invalid issuer");
      }
    });

    it("should fail to add existing issuer", async () => {
      await verifier.addIssuer(issuer.address);
      try {
        await verifier.addIssuer(issuer.address);
        expect.fail("Should have reverted");
      } catch (e: any) {
        expect(e.message).to.include("Already an issuer");
      }
    });

    it("should only allow owner to manage issuers", async () => {
      try {
        await verifier.connect(unauthorized).addIssuer(issuer.address);
        expect.fail("Should have reverted");
      } catch (e: any) {
        expect(e.message).to.include("revert");
      }
    });
  });

  describe("Credential Issuance", () => {
    beforeEach(async () => {
      await verifier.addIssuer(issuer.address);
    });

    it("should issue credential", async () => {
      await verifier
        .connect(issuer)
        .issueCredential(student.address, TEST_CRED_NAME, TEST_CRED_LEVEL, EXPIRATION_DAYS, TEST_METADATA);

      const creds = await verifier.getCredentialsByUser(student.address);
      expect(creds.length).to.equal(1);
    });

    it("should set credential details", async () => {
      await verifier
        .connect(issuer)
        .issueCredential(student.address, TEST_CRED_NAME, TEST_CRED_LEVEL, EXPIRATION_DAYS, TEST_METADATA);

      const cred = await verifier.getCredential(0n);
      expect(cred.name).to.equal(TEST_CRED_NAME);
      expect(cred.level).to.equal(TEST_CRED_LEVEL);
      expect(cred.issuer).to.equal(issuer.address);
    });

    it("should set expiration time", async () => {
      const timeBeforeIssue = BigInt((await ethers.provider.getBlock("latest"))!.timestamp);
      
      await verifier
        .connect(issuer)
        .issueCredential(student.address, TEST_CRED_NAME, TEST_CRED_LEVEL, EXPIRATION_DAYS, TEST_METADATA);

      const cred = await verifier.getCredential(0n);
      const expectedExpiration = timeBeforeIssue + BigInt(EXPIRATION_DAYS * 86400);
      
      expect(cred.expiresAt).to.be.approximately(expectedExpiration, 10n);
    });

    it("should mint NFT with metadata URI", async () => {
      await verifier
        .connect(issuer)
        .issueCredential(student.address, TEST_CRED_NAME, TEST_CRED_LEVEL, EXPIRATION_DAYS, TEST_METADATA);

      const uri = await nft.tokenURI(0n);
      expect(uri).to.equal(TEST_METADATA);
    });

    it("should fail with invalid student", async () => {
      try {
        await verifier
          .connect(issuer)
          .issueCredential(ethers.ZeroAddress, TEST_CRED_NAME, TEST_CRED_LEVEL, EXPIRATION_DAYS, TEST_METADATA);
        expect.fail("Should have reverted");
      } catch (e: any) {
        expect(e.message).to.include("Invalid student");
      }
    });

    it("should fail if not issuer", async () => {
      try {
        await verifier
          .connect(unauthorized)
          .issueCredential(student.address, TEST_CRED_NAME, TEST_CRED_LEVEL, EXPIRATION_DAYS, TEST_METADATA);
        expect.fail("Should have reverted");
      } catch (e: any) {
        expect(e.message).to.include("Not authorized");
      }
    });

    it("should support no-expiration credentials", async () => {
      await verifier
        .connect(issuer)
        .issueCredential(student.address, TEST_CRED_NAME, TEST_CRED_LEVEL, 0, TEST_METADATA); // 0 days = no expiration

      const cred = await verifier.getCredential(0n);
      expect(cred.expiresAt).to.equal(0n);
    });
  });

  describe("Credential Verification", () => {
    beforeEach(async () => {
      await verifier.addIssuer(issuer.address);
      await verifier
        .connect(issuer)
        .issueCredential(student.address, TEST_CRED_NAME, TEST_CRED_LEVEL, EXPIRATION_DAYS, TEST_METADATA);
    });

    it("should verify valid credential", async () => {
      const [valid, name, level] = await verifier.verifyCredential(0n);
      expect(valid).to.be.true;
      expect(name).to.equal(TEST_CRED_NAME);
      expect(level).to.equal(TEST_CRED_LEVEL);
    });

    it("should return false for revoked credential", async () => {
      await verifier.connect(issuer).revokeCredential(0n);
      const [valid] = await verifier.verifyCredential(0n);
      expect(valid).to.be.false;
    });

    it("should check credential validity", async () => {
      expect(await verifier.isCredentialValid(0n)).to.be.true;
    });

    it("should return false for invalid credential", async () => {
      await verifier.connect(issuer).revokeCredential(0n);
      expect(await verifier.isCredentialValid(0n)).to.be.false;
    });
  });

  describe("Credential Revocation", () => {
    beforeEach(async () => {
      await verifier.addIssuer(issuer.address);
      await verifier
        .connect(issuer)
        .issueCredential(student.address, TEST_CRED_NAME, TEST_CRED_LEVEL, EXPIRATION_DAYS, TEST_METADATA);
    });

    it("should revoke credential by issuer", async () => {
      await verifier.connect(issuer).revokeCredential(0n);
      const cred = await verifier.getCredential(0n);
      expect(cred.revoked).to.be.true;
    });

    it("should revoke credential by owner", async () => {
      await verifier.connect(owner).revokeCredential(0n);
      const cred = await verifier.getCredential(0n);
      expect(cred.revoked).to.be.true;
    });

    it("should fail to revoke already revoked credential", async () => {
      await verifier.connect(issuer).revokeCredential(0n);
      try {
        await verifier.connect(issuer).revokeCredential(0n);
        expect.fail("Should have reverted");
      } catch (e: any) {
        expect(e.message).to.include("Already revoked");
      }
    });

    it("should fail if not issuer or owner", async () => {
      try {
        await verifier.connect(unauthorized).revokeCredential(0n);
        expect.fail("Should have reverted");
      } catch (e: any) {
        expect(e.message).to.include("Not authorized");
      }
    });
  });

  describe("User Credentials", () => {
    beforeEach(async () => {
      await verifier.addIssuer(issuer.address);
      // Issue 3 credentials to student
      await verifier
        .connect(issuer)
        .issueCredential(student.address, "Credential 1", "Level A", EXPIRATION_DAYS, TEST_METADATA);
      await verifier
        .connect(issuer)
        .issueCredential(student.address, "Credential 2", "Level B", EXPIRATION_DAYS, TEST_METADATA);
      await verifier
        .connect(issuer)
        .issueCredential(student.address, "Credential 3", "Level C", EXPIRATION_DAYS, TEST_METADATA);
    });

    it("should get all credentials by user", async () => {
      const creds = await verifier.getCredentialsByUser(student.address);
      expect(creds.length).to.equal(3);
    });

    it("should get active credentials only", async () => {
      // Revoke one credential
      await verifier.connect(issuer).revokeCredential(1n);
      const activeCreds = await verifier.getActiveCredentialsByUser(student.address);
      expect(activeCreds.length).to.equal(2);
    });

    it("should fail for invalid user", async () => {
      try {
        await verifier.getCredentialsByUser(ethers.ZeroAddress);
        expect.fail("Should have reverted");
      } catch (e: any) {
        expect(e.message).to.include("Invalid user");
      }
    });

    it("should return empty array for user with no credentials", async () => {
      const creds = await verifier.getCredentialsByUser(student2.address);
      expect(creds.length).to.equal(0);
    });
  });

  describe("Expiration", () => {
    it("should handle expired credentials", async () => {
      await verifier.addIssuer(issuer.address);
      
      // Issue with 1 day expiration
      await verifier
        .connect(issuer)
        .issueCredential(student.address, TEST_CRED_NAME, TEST_CRED_LEVEL, 1, TEST_METADATA);

      // Credential should be valid immediately
      expect(await verifier.isCredentialValid(0n)).to.be.true;

      // Fast forward time
      await ethers.provider.send("hardhat_mine", ["0x"]);
      const blockTimestamp = await ethers.provider.getBlock("latest");
      await ethers.provider.send("hardhat_setNextBlockTimestamp", [blockTimestamp!.timestamp + 86400 * 2]); // 2 days later
      await ethers.provider.send("hardhat_mine", ["0x"]);

      // Now credential should be expired
      expect(await verifier.isCredentialValid(0n)).to.be.false;
    });
  });
});

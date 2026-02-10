import { expect as chaiExpect } from "chai";
import "@nomicfoundation/hardhat-chai-matchers";
import { ethers } from "hardhat";
import { CredentialNFT } from "../../../typechain";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

// Use any to bypass TypeScript type checking for Hardhat-specific matchers
const expect = chaiExpect as any;

describe("CredentialNFT Tests", () => {
  let nft: CredentialNFT;
  let owner: SignerWithAddress;
  let student1: SignerWithAddress;
  let student2: SignerWithAddress;
  let other: SignerWithAddress;

  const TEST_URI = "ipfs://QmTestCredential123";
  const TEST_URI_2 = "ipfs://QmTestCredential456";

  beforeEach(async () => {
    [owner, student1, student2, other] = await ethers.getSigners();

    const CredentialNFT_Factory = await ethers.getContractFactory("CredentialNFT");
    nft = await CredentialNFT_Factory.deploy();
    await nft.waitForDeployment();
  });

  describe("Deployment", () => {
    it("should have correct name and symbol", async () => {
      expect(await nft.name()).to.equal("VNDC Credentials");
      expect(await nft.symbol()).to.equal("VNDC-CRED");
    });

    it("should set owner", async () => {
      expect(await nft.owner()).to.equal(owner.address);
    });
  });

  describe("Minting", () => {
    it("should mint credential NFT", async () => {
      await nft.mint(student1.address, TEST_URI);
      expect(await nft.balanceOf(student1.address)).to.equal(1n);
    });

    it("should assign correct URI", async () => {
      await nft.mint(student1.address, TEST_URI);
      const uri = await nft.tokenURI(0n);
      expect(uri).to.equal(TEST_URI);
    });

    it("should mint multiple credentials to same student", async () => {
      await nft.mint(student1.address, TEST_URI);
      await nft.mint(student1.address, TEST_URI_2);
      expect(await nft.balanceOf(student1.address)).to.equal(2n);
    });

    it("should track tokens per owner", async () => {
      await nft.mint(student1.address, TEST_URI);
      await nft.mint(student1.address, TEST_URI_2);
      await nft.mint(student2.address, TEST_URI);

      const student1Tokens = await nft.tokensOfOwner(student1.address);
      const student2Tokens = await nft.tokensOfOwner(student2.address);

      expect(student1Tokens.length).to.equal(2);
      expect(student2Tokens.length).to.equal(1);
    });

    it("should fail if minting to zero address", async () => {
      try {
        await nft.mint(ethers.ZeroAddress, TEST_URI);
        expect.fail("Should have reverted");
      } catch (e: any) {
        expect(e.message).to.include("Cannot mint to zero address");
      }
    });

    it("should fail if URI is empty", async () => {
      try {
        await nft.mint(student1.address, "");
        expect.fail("Should have reverted");
      } catch (e: any) {
        expect(e.message).to.include("URI cannot be empty");
      }
    });

    it("should fail if not owner", async () => {
      try {
        await nft.connect(student1).mint(student1.address, TEST_URI);
        expect.fail("Should have reverted");
      } catch (e: any) {
        expect(e.message).to.include("revert");
      }
    });
  });

  describe("Burning", () => {
    beforeEach(async () => {
      await nft.mint(student1.address, TEST_URI);
      await nft.mint(student1.address, TEST_URI_2);
    });

    it("should burn credential", async () => {
      const tokenId = 0n;
      await nft.connect(student1).burn(tokenId);
      expect(await nft.balanceOf(student1.address)).to.equal(1n);
    });

    it("should remove from owner tokens list", async () => {
      await nft.connect(student1).burn(0n);
      const tokens = await nft.tokensOfOwner(student1.address);
      expect(tokens).to.have.lengthOf(1);
      expect(tokens[0]).to.equal(1n);
    });

    it("should mark token as non-existent", async () => {
      await nft.connect(student1).burn(0n);
      expect(await nft.exists(0n)).to.be.false;
    });

    it("should fail to burn non-existent token", async () => {
      try {
        await nft.connect(student1).burn(999n);
        expect.fail("Should have reverted");
      } catch (e: any) {
        expect(e.message).to.include("Token does not exist");
      }
    });

    it("should only allow owner to burn", async () => {
      try {
        await nft.connect(student2).burn(0n);
        expect.fail("Should have reverted");
      } catch (e: any) {
        expect(e.message).to.include("revert");
      }
    });
  });

  describe("Token Existence", () => {
    it("should track token existence", async () => {
      await nft.mint(student1.address, TEST_URI);
      expect(await nft.exists(0n)).to.be.true;
      
      await nft.connect(student1).burn(0n);
      expect(await nft.exists(0n)).to.be.false;
    });
  });

  describe("Interface Support", () => {
    it("should support ERC721", async () => {
      const ERC721_ID = "0x80ac58cd";
      expect(await nft.supportsInterface(ERC721_ID)).to.be.true;
    });

    it("should support ERC165", async () => {
      const ERC165_ID = "0x01ffc9a7";
      expect(await nft.supportsInterface(ERC165_ID)).to.be.true;
    });
  });
});

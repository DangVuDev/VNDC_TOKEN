import { expect } from "chai";
import { ethers } from "hardhat";
import { TaskManager, VNDCToken } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";

// Helper: build the EIP-712 domain and sign a ClaimProof
async function signClaimProof(
  signer: HardhatEthersSigner,
  contract: TaskManager,
  proof: { taskId: string; student: string; nonce: bigint; deadline: bigint }
) {
  const domain = {
    name: "VNDCTaskManager",
    version: "1",
    chainId: (await ethers.provider.getNetwork()).chainId,
    verifyingContract: await contract.getAddress(),
  };
  const types = {
    ClaimProof: [
      { name: "taskId",   type: "bytes32" },
      { name: "student",  type: "address" },
      { name: "nonce",    type: "uint256" },
      { name: "deadline", type: "uint256" },
    ],
  };
  return signer.signTypedData(domain, types, proof);
}

describe("TaskManager", function () {
  let vndc: VNDCToken;
  let manager: TaskManager;

  let owner: HardhatEthersSigner;   // contract owner / admin
  let backend: HardhatEthersSigner; // EIP-712 signer (simulates off-chain backend)
  let student: HardhatEthersSigner;
  let student2: HardhatEthersSigner;

  const POOL_AMOUNT   = ethers.parseEther("10000");
  const REWARD_AMOUNT = ethers.parseEther("100");
  const MAX_SLOTS     = 5n;

  // Deterministic taskId (keccak256 of some off-chain MongoDB _id)
  const TASK_ID = ethers.keccak256(ethers.toUtf8Bytes("task-mongo-id-001"));

  beforeEach(async function () {
    [owner, backend, student, student2] = await ethers.getSigners();

    // Deploy VNDC
    const VNDCFactory = await ethers.getContractFactory("VNDCToken");
    vndc = (await VNDCFactory.deploy(ethers.parseEther("1000000"))) as unknown as VNDCToken;
    await vndc.waitForDeployment();

    // Deploy TaskManager
    const TMFactory = await ethers.getContractFactory("TaskManager");
    manager = (await TMFactory.deploy(
      await vndc.getAddress(),
      backend.address
    )) as unknown as TaskManager;
    await manager.waitForDeployment();

    // Approve + fund the pool
    await vndc.approve(await manager.getAddress(), POOL_AMOUNT);
    await manager.fundPool(POOL_AMOUNT);
  });

  // ── Deployment ──────────────────────────────────────────────────────────────

  describe("Deployment", function () {
    it("sets vndc address", async function () {
      expect(await manager.vndc()).to.equal(await vndc.getAddress());
    });

    it("sets signer address", async function () {
      expect(await manager.signer()).to.equal(backend.address);
    });

    it("sets pool balance after fundPool", async function () {
      expect(await manager.poolBalance()).to.equal(POOL_AMOUNT);
    });

    it("reverts on zero vndc address", async function () {
      const TMFactory = await ethers.getContractFactory("TaskManager");
      await expect(
        TMFactory.deploy(ethers.ZeroAddress, backend.address)
      ).to.be.revertedWith("zero vndc");
    });

    it("reverts on zero signer address", async function () {
      const TMFactory = await ethers.getContractFactory("TaskManager");
      await expect(
        TMFactory.deploy(await vndc.getAddress(), ethers.ZeroAddress)
      ).to.be.revertedWith("zero signer");
    });
  });

  // ── Pool Management ─────────────────────────────────────────────────────────

  describe("Pool Management", function () {
    it("owner can fund pool", async function () {
      const extra = ethers.parseEther("500");
      await vndc.approve(await manager.getAddress(), extra);
      await expect(manager.fundPool(extra))
        .to.emit(manager, "PoolFunded")
        .withArgs(owner.address, extra, POOL_AMOUNT + extra);

      expect(await manager.poolBalance()).to.equal(POOL_AMOUNT + extra);
    });

    it("reverts fundPool with zero amount", async function () {
      await expect(manager.fundPool(0n)).to.be.revertedWith("zero amount");
    });

    it("non-owner cannot fund pool", async function () {
      await vndc.transfer(student.address, ethers.parseEther("100"));
      await vndc.connect(student).approve(await manager.getAddress(), ethers.parseEther("100"));
      await expect(manager.connect(student).fundPool(ethers.parseEther("100")))
        .to.be.reverted;
    });

    it("owner can withdraw pool", async function () {
      const ownerBefore = await vndc.balanceOf(owner.address);
      await manager.withdrawPool(owner.address, POOL_AMOUNT);
      expect(await manager.poolBalance()).to.equal(0n);
      expect(await vndc.balanceOf(owner.address)).to.equal(ownerBefore + POOL_AMOUNT);
    });

    it("reverts withdrawPool when amount exceeds balance", async function () {
      await expect(
        manager.withdrawPool(owner.address, POOL_AMOUNT + 1n)
      ).to.be.revertedWith("insufficient pool");
    });
  });

  // ── Task Registration ───────────────────────────────────────────────────────

  describe("Task Registration", function () {
    it("owner can register a task", async function () {
      await expect(manager.registerTask(TASK_ID, REWARD_AMOUNT, MAX_SLOTS))
        .to.emit(manager, "TaskRegistered")
        .withArgs(TASK_ID, REWARD_AMOUNT, MAX_SLOTS);

      const t = await manager.getTask(TASK_ID);
      expect(t.rewardAmount).to.equal(REWARD_AMOUNT);
      expect(t.maxSlots).to.equal(MAX_SLOTS);
      expect(t.claimedSlots).to.equal(0n);
      expect(t.active).to.be.true;
    });

    it("reverts on zero taskId", async function () {
      await expect(manager.registerTask(ethers.ZeroHash, REWARD_AMOUNT, MAX_SLOTS))
        .to.be.revertedWith("zero taskId");
    });

    it("reverts on zero reward", async function () {
      await expect(manager.registerTask(TASK_ID, 0n, MAX_SLOTS))
        .to.be.revertedWith("zero reward");
    });

    it("reverts on zero slots", async function () {
      await expect(manager.registerTask(TASK_ID, REWARD_AMOUNT, 0n))
        .to.be.revertedWith("zero slots");
    });

    it("reverts on duplicate registration", async function () {
      await manager.registerTask(TASK_ID, REWARD_AMOUNT, MAX_SLOTS);
      await expect(manager.registerTask(TASK_ID, REWARD_AMOUNT, MAX_SLOTS))
        .to.be.revertedWith("already registered");
    });

    it("non-owner cannot register task", async function () {
      await expect(
        manager.connect(student).registerTask(TASK_ID, REWARD_AMOUNT, MAX_SLOTS)
      ).to.be.reverted;
    });

    it("owner can deactivate a task", async function () {
      await manager.registerTask(TASK_ID, REWARD_AMOUNT, MAX_SLOTS);
      await expect(manager.deactivateTask(TASK_ID))
        .to.emit(manager, "TaskDeactivated")
        .withArgs(TASK_ID);

      expect((await manager.getTask(TASK_ID)).active).to.be.false;
    });

    it("reverts deactivate on inactive task", async function () {
      await manager.registerTask(TASK_ID, REWARD_AMOUNT, MAX_SLOTS);
      await manager.deactivateTask(TASK_ID);
      await expect(manager.deactivateTask(TASK_ID)).to.be.revertedWith("not active");
    });
  });

  // ── claimReward ─────────────────────────────────────────────────────────────

  describe("claimReward", function () {
    const NONCE_1 = 1001n;

    async function makeProof(
      studentAddr: string,
      nonce: bigint,
      deadlineOffset = 3600
    ) {
      const deadline = BigInt(await time.latest()) + BigInt(deadlineOffset);
      return {
        taskId:   TASK_ID as `0x${string}`,
        student:  studentAddr as `0x${string}`,
        nonce,
        deadline,
      };
    }

    beforeEach(async function () {
      await manager.registerTask(TASK_ID, REWARD_AMOUNT, MAX_SLOTS);
    });

    it("student claims successfully with valid signature", async function () {
      const proof = await makeProof(student.address, NONCE_1);
      const sig   = await signClaimProof(backend, manager, proof);

      const beforeBalance = await vndc.balanceOf(student.address);
      await expect(manager.connect(student).claimReward(proof, sig))
        .to.emit(manager, "RewardClaimed")
        .withArgs(TASK_ID, student.address, REWARD_AMOUNT, 1n);

      expect(await vndc.balanceOf(student.address)).to.equal(beforeBalance + REWARD_AMOUNT);
      expect(await manager.poolBalance()).to.equal(POOL_AMOUNT - REWARD_AMOUNT);
    });

    it("increments activityPoints for student", async function () {
      const proof = await makeProof(student.address, NONCE_1);
      const sig   = await signClaimProof(backend, manager, proof);
      await manager.connect(student).claimReward(proof, sig);
      expect(await manager.activityPoints(student.address)).to.equal(1n);
    });

    it("increments claimedSlots on the task", async function () {
      const proof = await makeProof(student.address, NONCE_1);
      const sig   = await signClaimProof(backend, manager, proof);
      await manager.connect(student).claimReward(proof, sig);
      expect((await manager.getTask(TASK_ID)).claimedSlots).to.equal(1n);
    });

    it("reverts with invalid signature (wrong signer)", async function () {
      const proof = await makeProof(student.address, NONCE_1);
      // Sign with owner (not the authorised backend signer)
      const sig = await signClaimProof(owner, manager, proof);
      await expect(manager.connect(student).claimReward(proof, sig))
        .to.be.revertedWith("invalid signature");
    });

    it("reverts on nonce replay", async function () {
      const proof = await makeProof(student.address, NONCE_1);
      const sig   = await signClaimProof(backend, manager, proof);
      await manager.connect(student).claimReward(proof, sig);

      // Try the same proof again
      await expect(manager.connect(student).claimReward(proof, sig))
        .to.be.revertedWith("nonce already used");
    });

    it("reverts when claiming on behalf of another address", async function () {
      const proof = await makeProof(student.address, NONCE_1);
      const sig   = await signClaimProof(backend, manager, proof);
      // student2 tries to submit the proof belonging to student
      await expect(manager.connect(student2).claimReward(proof, sig))
        .to.be.revertedWith("not your claim");
    });

    it("reverts when deadline has passed", async function () {
      const deadline = BigInt(await time.latest()) - 1n; // already expired
      const proof = { taskId: TASK_ID as `0x${string}`, student: student.address as `0x${string}`, nonce: NONCE_1, deadline };
      const sig   = await signClaimProof(backend, manager, proof);
      await expect(manager.connect(student).claimReward(proof, sig))
        .to.be.revertedWith("deadline expired");
    });

    it("reverts when task is inactive", async function () {
      await manager.deactivateTask(TASK_ID);
      const proof = await makeProof(student.address, NONCE_1);
      const sig   = await signClaimProof(backend, manager, proof);
      await expect(manager.connect(student).claimReward(proof, sig))
        .to.be.revertedWith("task inactive");
    });

    it("reverts when all slots are full", async function () {
      // Register a task with 1 slot only
      const TINY_TASK = ethers.keccak256(ethers.toUtf8Bytes("tiny-task"));
      await manager.registerTask(TINY_TASK, REWARD_AMOUNT, 1n);

      const proof1 = {
        taskId:   TINY_TASK as `0x${string}`,
        student:  student.address as `0x${string}`,
        nonce:    1n,
        deadline: BigInt(await time.latest()) + 3600n,
      };
      const sig1 = await signClaimProof(backend, manager, proof1);
      await manager.connect(student).claimReward(proof1, sig1);

      // Second student tries the same task
      const proof2 = {
        taskId:   TINY_TASK as `0x${string}`,
        student:  student2.address as `0x${string}`,
        nonce:    2n,
        deadline: BigInt(await time.latest()) + 3600n,
      };
      const sig2 = await signClaimProof(backend, manager, proof2);
      await expect(manager.connect(student2).claimReward(proof2, sig2))
        .to.be.revertedWith("slots full");
    });

    it("reverts when pool is empty", async function () {
      await manager.withdrawPool(owner.address, POOL_AMOUNT); // drain pool
      const proof = await makeProof(student.address, NONCE_1);
      const sig   = await signClaimProof(backend, manager, proof);
      await expect(manager.connect(student).claimReward(proof, sig))
        .to.be.revertedWith("pool insufficient");
    });

    it("reverts when contract is paused", async function () {
      await manager.pause();
      const proof = await makeProof(student.address, NONCE_1);
      const sig   = await signClaimProof(backend, manager, proof);
      await expect(manager.connect(student).claimReward(proof, sig))
        .to.be.reverted; // EnforcedPause
    });

    it("works after unpause", async function () {
      await manager.pause();
      await manager.unpause();
      const proof = await makeProof(student.address, NONCE_1);
      const sig   = await signClaimProof(backend, manager, proof);
      await expect(manager.connect(student).claimReward(proof, sig))
        .to.emit(manager, "RewardClaimed");
    });

    it("multiple students can claim the same task (different nonces)", async function () {
      const p1 = await makeProof(student.address, 1n);
      const p2 = await makeProof(student2.address, 2n);
      const s1 = await signClaimProof(backend, manager, p1);
      const s2 = await signClaimProof(backend, manager, p2);

      await manager.connect(student).claimReward(p1, s1);
      await manager.connect(student2).claimReward(p2, s2);

      expect(await manager.activityPoints(student.address)).to.equal(1n);
      expect(await manager.activityPoints(student2.address)).to.equal(1n);
      expect((await manager.getTask(TASK_ID)).claimedSlots).to.equal(2n);
    });
  });

  // ── Signer Management ───────────────────────────────────────────────────────

  describe("Signer Management", function () {
    it("owner can update signer", async function () {
      await expect(manager.updateSigner(student.address))
        .to.emit(manager, "SignerUpdated")
        .withArgs(backend.address, student.address);
      expect(await manager.signer()).to.equal(student.address);
    });

    it("reverts on zero signer", async function () {
      await expect(manager.updateSigner(ethers.ZeroAddress))
        .to.be.revertedWith("zero signer");
    });

    it("non-owner cannot update signer", async function () {
      await expect(manager.connect(student).updateSigner(student.address))
        .to.be.reverted;
    });

    it("claim fails after signer is rotated (old sig)", async function () {
      await manager.registerTask(TASK_ID, REWARD_AMOUNT, MAX_SLOTS);
      const proof = {
        taskId:   TASK_ID as `0x${string}`,
        student:  student.address as `0x${string}`,
        nonce:    1n,
        deadline: BigInt(await time.latest()) + 3600n,
      };
      const sig = await signClaimProof(backend, manager, proof);
      // Rotate signer
      await manager.updateSigner(student2.address);
      await expect(manager.connect(student).claimReward(proof, sig))
        .to.be.revertedWith("invalid signature");
    });
  });

  // ── View Helpers ────────────────────────────────────────────────────────────

  describe("View Helpers", function () {
    it("isNonceUsed returns false before claim", async function () {
      expect(await manager.isNonceUsed(student.address, TASK_ID, 1n)).to.be.false;
    });

    it("isNonceUsed returns true after claim", async function () {
      await manager.registerTask(TASK_ID, REWARD_AMOUNT, MAX_SLOTS);
      const proof = {
        taskId:   TASK_ID as `0x${string}`,
        student:  student.address as `0x${string}`,
        nonce:    1n,
        deadline: BigInt(await time.latest()) + 3600n,
      };
      const sig = await signClaimProof(backend, manager, proof);
      await manager.connect(student).claimReward(proof, sig);
      expect(await manager.isNonceUsed(student.address, TASK_ID, 1n)).to.be.true;
    });

    it("getActivityPoints returns correct count", async function () {
      await manager.registerTask(TASK_ID, REWARD_AMOUNT, MAX_SLOTS);
      expect(await manager.getActivityPoints(student.address)).to.equal(0n);

      const proof = {
        taskId:   TASK_ID as `0x${string}`,
        student:  student.address as `0x${string}`,
        nonce:    1n,
        deadline: BigInt(await time.latest()) + 3600n,
      };
      const sig = await signClaimProof(backend, manager, proof);
      await manager.connect(student).claimReward(proof, sig);
      expect(await manager.getActivityPoints(student.address)).to.equal(1n);
    });
  });
});

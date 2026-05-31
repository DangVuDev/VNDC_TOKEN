/**
 * TaskManager-claimReward.ts
 * Claim a task reward for a student (owner-only — called by backend after proof verification).
 *
 * Env vars (required):
 *   TASK_ID   — bytes32 task ID
 *   STUDENT   — Student wallet address
 *   REWARD    — Reward amount in VNDC (must match task reward)
 *   NONCE     — Unique nonce for replay protection (use incrementing integer per student)
 *
 * Env vars (optional):
 *   TASK_NAME — Human-readable name to hash into TASK_ID (overrides TASK_ID)
 *
 * Usage:
 *   TASK_NAME="quiz-week-1" STUDENT=0x... REWARD=10 NONCE=1 \
 *     npx hardhat run scripts/TaskManager-claimReward.ts --network localhost
 */
import { ethers, network } from "hardhat"
import { requireAddress, env, envOptional, parseVNDC, formatVNDC, shortAddr, hr } from "./_utils"

async function main() {
  hr("TaskManager — Claim Reward")

  const [signer] = await ethers.getSigners()

  const taskName = envOptional("TASK_NAME", "")
  let taskId: string
  if (taskName) {
    taskId = ethers.keccak256(ethers.toUtf8Bytes(taskName))
    console.log(`Task name : ${taskName}`)
  } else {
    taskId = env("TASK_ID")
  }

  const student = env("STUDENT")
  const reward = parseVNDC(env("REWARD"))
  const nonce = Number(env("NONCE"))

  const tmAddress = requireAddress(network.name, "TaskManager")
  const tm = await ethers.getContractAt("TaskManager", tmAddress, signer)

  console.log(`TaskManager : ${tmAddress}`)
  console.log(`Signer      : ${signer.address}`)
  console.log(`Task ID     : ${taskId}`)
  console.log(`Student     : ${student}`)
  console.log(`Reward      : ${formatVNDC(reward)}`)
  console.log(`Nonce       : ${nonce}`)

  // Validations
  const task = await (tm as any).getTask(taskId)
  if (!task.active) throw new Error(`Task ${taskId} is not active.`)
  if (task.claimedSlots >= task.maxSlots) throw new Error(`Task slots are full (${task.claimedSlots}/${task.maxSlots}).`)

  const nonceUsed = await (tm as any).isNonceUsed(student, taskId, nonce)
  if (nonceUsed) throw new Error(`Nonce ${nonce} already used for student ${shortAddr(student)}.`)

  const poolBalance = await (tm as any).poolBalance()
  if (poolBalance < reward) throw new Error(`Insufficient pool: ${formatVNDC(poolBalance)} < ${formatVNDC(reward)}`)

  const tx = await (tm as any).claimReward(taskId, student, reward, nonce)
  console.log(`\nTx hash  : ${tx.hash}`)
  await tx.wait()

  const points = await (tm as any).getActivityPoints(student)
  console.log(`✅ Reward claimed: ${formatVNDC(reward)} → ${shortAddr(student)}`)
  console.log(`   Activity points: ${points}`)
  hr()
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})

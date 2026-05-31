/**
 * TaskManager-registerTask.ts
 * Register a new task on-chain (requires owner).
 *
 * Env vars (required):
 *   TASK_ID       — bytes32 task ID (e.g. "0xabc..." or use TASK_NAME to auto-hash)
 *   REWARD        — Reward per completion in VNDC (e.g. "10")
 *   MAX_SLOTS     — Maximum number of completions allowed
 *
 * Env vars (optional):
 *   TASK_NAME     — Human-readable name to hash into TASK_ID (overrides TASK_ID)
 *
 * Usage:
 *   TASK_NAME="quiz-week-1" REWARD=10 MAX_SLOTS=100 \
 *     npx hardhat run scripts/TaskManager-registerTask.ts --network localhost
 */
import { ethers, network } from "hardhat"
import { requireAddress, env, envOptional, parseVNDC, formatVNDC, hr } from "./_utils"

async function main() {
  hr("TaskManager — Register Task")

  const [signer] = await ethers.getSigners()

  const taskName = envOptional("TASK_NAME", "")
  let taskId: string
  if (taskName) {
    taskId = ethers.keccak256(ethers.toUtf8Bytes(taskName))
    console.log(`Task name : ${taskName}`)
  } else {
    taskId = env("TASK_ID")
  }

  const rewardVNDC = env("REWARD")
  const rewardWei = parseVNDC(rewardVNDC)
  const maxSlots = Number(env("MAX_SLOTS"))

  const tmAddress = requireAddress(network.name, "TaskManager")
  const tm = await ethers.getContractAt("TaskManager", tmAddress, signer)

  console.log(`TaskManager : ${tmAddress}`)
  console.log(`Signer      : ${signer.address}`)
  console.log(`Task ID     : ${taskId}`)
  console.log(`Reward      : ${formatVNDC(rewardWei)}`)
  console.log(`Max slots   : ${maxSlots}`)

  const existing = await (tm as any).getTask(taskId)
  if (existing.active) {
    console.log(`⚠️  Task ${taskId} is already registered and active.`)
    return
  }

  const tx = await (tm as any).registerTask(taskId, rewardWei, maxSlots)
  console.log(`\nTx hash  : ${tx.hash}`)
  await tx.wait()

  console.log(`✅ Task registered: ${taskId}`)
  console.log(`   Reward: ${formatVNDC(rewardWei)} × ${maxSlots} slots = ${formatVNDC(rewardWei * BigInt(maxSlots))} total`)
  hr()
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})

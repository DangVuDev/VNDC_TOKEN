/**
 * TaskManager-deactivateTask.ts
 * Deactivate a task to stop new claims (owner-only).
 *
 * Env vars (required):
 *   TASK_ID   — bytes32 task ID to deactivate
 *
 * Env vars (optional):
 *   TASK_NAME — Human-readable name to hash into TASK_ID (overrides TASK_ID)
 *
 * Usage:
 *   TASK_NAME="quiz-week-1" npx hardhat run scripts/TaskManager-deactivateTask.ts --network localhost
 */
import { ethers, network } from "hardhat"
import { requireAddress, env, envOptional, formatVNDC, hr } from "./_utils"

async function main() {
  hr("TaskManager — Deactivate Task")

  const [signer] = await ethers.getSigners()

  const taskName = envOptional("TASK_NAME", "")
  let taskId: string
  if (taskName) {
    taskId = ethers.keccak256(ethers.toUtf8Bytes(taskName))
    console.log(`Task name : ${taskName}`)
  } else {
    taskId = env("TASK_ID")
  }

  const tmAddress = requireAddress(network.name, "TaskManager")
  const tm = await ethers.getContractAt("TaskManager", tmAddress, signer)

  console.log(`TaskManager : ${tmAddress}`)
  console.log(`Signer      : ${signer.address}`)
  console.log(`Task ID     : ${taskId}`)

  const task = await (tm as any).getTask(taskId)
  if (!task.active) {
    console.log(`⚠️  Task is already inactive.`)
    console.log(`   Claimed: ${task.claimedSlots}/${task.maxSlots} slots`)
    return
  }

  console.log(`Reward      : ${formatVNDC(task.rewardAmount)}`)
  console.log(`Progress    : ${task.claimedSlots}/${task.maxSlots} slots`)

  const tx = await (tm as any).deactivateTask(taskId)
  console.log(`\nTx hash  : ${tx.hash}`)
  await tx.wait()

  console.log(`✅ Task deactivated: ${taskId}`)
  hr()
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})

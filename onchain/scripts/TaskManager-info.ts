/**
 * TaskManager-info.ts
 * Display TaskManager pool state and optionally inspect a specific task.
 *
 * Env vars (optional):
 *   TASK_ID      — bytes32 task ID to inspect
 *   TASK_NAME    — Human-readable name to hash into TASK_ID
 *   CHECK_WALLET — Address to check activity points for
 *
 * Usage:
 *   npx hardhat run scripts/TaskManager-info.ts --network localhost
 *   TASK_NAME="quiz-week-1" CHECK_WALLET=0x... npx hardhat run scripts/TaskManager-info.ts --network localhost
 */
import { ethers, network } from "hardhat"
import { requireAddress, envOptional, formatVNDC, hr } from "./_utils"

async function main() {
  hr("TaskManager — Info")

  const tmAddress = requireAddress(network.name, "TaskManager")
  const tm = await ethers.getContractAt("TaskManager", tmAddress)

  const [owner, paused, poolBalance, vndcAddr] = await Promise.all([
    (tm as any).owner(),
    (tm as any).paused(),
    (tm as any).poolBalance(),
    (tm as any).vndc(),
  ])

  console.log(`Contract     : ${tmAddress}`)
  console.log(`Network      : ${network.name}`)
  console.log(`Owner        : ${owner}`)
  console.log(`VNDC token   : ${vndcAddr}`)
  console.log(`Paused       : ${paused}`)
  console.log(`Pool balance : ${formatVNDC(poolBalance)}`)

  // Inspect specific task
  const taskName = envOptional("TASK_NAME", "")
  const taskIdEnv = envOptional("TASK_ID", "")
  let taskId = ""
  if (taskName) {
    taskId = ethers.keccak256(ethers.toUtf8Bytes(taskName))
    console.log(`\n── Task: "${taskName}" (${taskId})`)
  } else if (taskIdEnv) {
    taskId = taskIdEnv
    console.log(`\n── Task: ${taskId}`)
  }

  if (taskId) {
    const task = await (tm as any).getTask(taskId)
    console.log(`  Active      : ${task.active}`)
    console.log(`  Reward      : ${formatVNDC(task.rewardAmount)}`)
    console.log(`  Slots       : ${task.claimedSlots}/${task.maxSlots}`)
    console.log(`  Remaining   : ${task.maxSlots - task.claimedSlots} slots`)
    console.log(`  Committed   : ${formatVNDC(task.rewardAmount * task.maxSlots)}`)
  }

  // Check wallet activity
  const checkWallet = envOptional("CHECK_WALLET", "")
  if (checkWallet) {
    const points = await (tm as any).getActivityPoints(checkWallet)
    console.log(`\n── Wallet: ${checkWallet}`)
    console.log(`  Activity points: ${points}`)
  }

  hr()
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})

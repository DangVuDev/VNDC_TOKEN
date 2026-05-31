/**
 * TaskManager-pause.ts
 * Pause the TaskManager contract (owner-only). Blocks claimReward calls.
 *
 * Usage:
 *   npx hardhat run scripts/TaskManager-pause.ts --network localhost
 */
import { ethers, network } from "hardhat"
import { requireAddress, hr } from "./_utils"

async function main() {
  hr("TaskManager — Pause")

  const [signer] = await ethers.getSigners()
  const tmAddress = requireAddress(network.name, "TaskManager")
  const tm = await ethers.getContractAt("TaskManager", tmAddress, signer)

  console.log(`Contract : ${tmAddress}`)
  console.log(`Signer   : ${signer.address}`)

  if (await (tm as any).paused()) {
    console.log("⚠️  Already paused.")
    return
  }

  const tx = await (tm as any).pause()
  console.log(`\nTx hash  : ${tx.hash}`)
  await tx.wait()
  console.log(`✅ TaskManager paused.`)
  hr()
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})

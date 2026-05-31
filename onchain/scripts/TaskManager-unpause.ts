/**
 * TaskManager-unpause.ts
 * Unpause the TaskManager contract (owner-only).
 *
 * Usage:
 *   npx hardhat run scripts/TaskManager-unpause.ts --network localhost
 */
import { ethers, network } from "hardhat"
import { requireAddress, hr } from "./_utils"

async function main() {
  hr("TaskManager — Unpause")

  const [signer] = await ethers.getSigners()
  const tmAddress = requireAddress(network.name, "TaskManager")
  const tm = await ethers.getContractAt("TaskManager", tmAddress, signer)

  console.log(`Contract : ${tmAddress}`)
  console.log(`Signer   : ${signer.address}`)

  if (!(await (tm as any).paused())) {
    console.log("⚠️  Not paused.")
    return
  }

  const tx = await (tm as any).unpause()
  console.log(`\nTx hash  : ${tx.hash}`)
  await tx.wait()
  console.log(`✅ TaskManager unpaused.`)
  hr()
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})

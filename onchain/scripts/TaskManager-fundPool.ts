/**
 * TaskManager-fundPool.ts
 * Fund the TaskManager reward pool with VNDC tokens (requires owner).
 * Caller must approve TaskManager to spend at least AMOUNT of VNDC.
 *
 * Env vars (required):
 *   AMOUNT  — Amount in VNDC to add to the pool
 *
 * Usage:
 *   AMOUNT=50000 npx hardhat run scripts/TaskManager-fundPool.ts --network localhost
 */
import { ethers, network } from "hardhat"
import { requireAddress, env, parseVNDC, formatVNDC, hr } from "./_utils"

async function main() {
  hr("TaskManager — Fund Pool")

  const [signer] = await ethers.getSigners()
  const amount = parseVNDC(env("AMOUNT"))

  const tokenAddress = requireAddress(network.name, "VNDCToken")
  const tmAddress = requireAddress(network.name, "TaskManager")

  const token = await ethers.getContractAt("VNDCToken", tokenAddress, signer)
  const tm = await ethers.getContractAt("TaskManager", tmAddress, signer)

  console.log(`TaskManager : ${tmAddress}`)
  console.log(`Signer      : ${signer.address}`)
  console.log(`Amount      : ${formatVNDC(amount)}`)

  const poolBefore = await (tm as any).poolBalance()
  console.log(`Pool before : ${formatVNDC(poolBefore)}`)

  // Approve
  const allowance = await (token as any).allowance(signer.address, tmAddress)
  if (allowance < amount) {
    console.log(`\nApproving ${formatVNDC(amount)}...`)
    const approveTx = await (token as any).approve(tmAddress, amount)
    await approveTx.wait()
    console.log(`✅ Approved`)
  }

  const tx = await (tm as any).fundPool(amount)
  console.log(`\nTx hash  : ${tx.hash}`)
  await tx.wait()

  const poolAfter = await (tm as any).poolBalance()
  console.log(`Pool after  : ${formatVNDC(poolAfter)}`)
  console.log(`✅ Pool funded with ${formatVNDC(amount)}`)
  hr()
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})

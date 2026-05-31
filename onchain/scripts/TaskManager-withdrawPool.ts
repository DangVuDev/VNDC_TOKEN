/**
 * TaskManager-withdrawPool.ts
 * Withdraw VNDC tokens from the task reward pool back to owner (owner-only).
 *
 * Env vars (required):
 *   TO      — Recipient address for withdrawn funds
 *   AMOUNT  — Amount in VNDC to withdraw
 *
 * Usage:
 *   TO=0xOwner AMOUNT=5000 npx hardhat run scripts/TaskManager-withdrawPool.ts --network localhost
 */
import { ethers, network } from "hardhat"
import { requireAddress, env, parseVNDC, formatVNDC, shortAddr, hr } from "./_utils"

async function main() {
  hr("TaskManager — Withdraw Pool")

  const [signer] = await ethers.getSigners()
  const to = env("TO")
  const amount = parseVNDC(env("AMOUNT"))

  const tmAddress = requireAddress(network.name, "TaskManager")
  const tm = await ethers.getContractAt("TaskManager", tmAddress, signer)

  console.log(`TaskManager : ${tmAddress}`)
  console.log(`Signer      : ${signer.address}`)
  console.log(`To          : ${to}`)
  console.log(`Amount      : ${formatVNDC(amount)}`)

  const poolBalance = await (tm as any).poolBalance()
  console.log(`Pool balance: ${formatVNDC(poolBalance)}`)

  if (poolBalance < amount) {
    throw new Error(`Insufficient pool: ${formatVNDC(poolBalance)} < ${formatVNDC(amount)}`)
  }

  const tx = await (tm as any).withdrawPool(to, amount)
  console.log(`\nTx hash  : ${tx.hash}`)
  await tx.wait()

  const poolAfter = await (tm as any).poolBalance()
  console.log(`Pool after  : ${formatVNDC(poolAfter)}`)
  console.log(`✅ Withdrawn ${formatVNDC(amount)} to ${shortAddr(to)}`)
  hr()
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})

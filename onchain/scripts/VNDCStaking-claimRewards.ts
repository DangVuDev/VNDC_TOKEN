/**
 * VNDCStaking-claimRewards.ts
 * Claim pending staking rewards without unstaking principal.
 *
 * Usage:
 *   npx hardhat run scripts/VNDCStaking-claimRewards.ts --network localhost
 */
import { ethers, network } from "hardhat"
import { requireAddress, formatVNDC, hr } from "./_utils"

async function main() {
  hr("VNDCStaking — Claim Rewards")

  const [signer] = await ethers.getSigners()
  const stakingAddress = requireAddress(network.name, "VNDCStaking")
  const staking = await ethers.getContractAt("VNDCStaking", stakingAddress, signer)

  console.log(`Contract : ${stakingAddress}`)
  console.log(`Signer   : ${signer.address}`)

  const pending = await (staking as any).calculatePendingRewards(signer.address)
  if (pending === 0n) {
    console.log("⚠️  No pending rewards to claim.")
    return
  }

  console.log(`Pending rewards: ${formatVNDC(pending)}`)

  const tx = await (staking as any).claimRewards()
  console.log(`\nTx hash  : ${tx.hash}`)
  const receipt = await tx.wait()
  console.log(`Block    : ${receipt.blockNumber}`)

  console.log(`✅ Claimed ${formatVNDC(pending)}`)
  hr()
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})

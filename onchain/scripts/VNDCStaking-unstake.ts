/**
 * VNDCStaking-unstake.ts
 * Unstake VNDC tokens and collect earned rewards.
 * Tokens must be past the lock period.
 *
 * Usage:
 *   npx hardhat run scripts/VNDCStaking-unstake.ts --network localhost
 */
import { ethers, network } from "hardhat"
import { requireAddress, formatVNDC, hr } from "./_utils"

async function main() {
  hr("VNDCStaking — Unstake")

  const [signer] = await ethers.getSigners()
  const stakingAddress = requireAddress(network.name, "VNDCStaking")
  const staking = await ethers.getContractAt("VNDCStaking", stakingAddress, signer)

  console.log(`Contract : ${stakingAddress}`)
  console.log(`Signer   : ${signer.address}`)

  const stakeInfo = await (staking as any).getStake(signer.address)
  if (stakeInfo.amount === 0n) {
    console.log("⚠️  No active stake found.")
    return
  }

  const timeToUnlock = await (staking as any).getTimeToUnlock(signer.address)
  if (timeToUnlock > 0n) {
    const days = Math.floor(Number(timeToUnlock) / 86400)
    const hours = Math.floor((Number(timeToUnlock) % 86400) / 3600)
    console.log(`⚠️  Stake still locked. ${days}d ${hours}h remaining.`)
    console.log(`   Staked: ${formatVNDC(stakeInfo.amount)}`)
    return
  }

  const pendingRewards = await (staking as any).calculatePendingRewards(signer.address)
  console.log(`Staked           : ${formatVNDC(stakeInfo.amount)}`)
  console.log(`Pending rewards  : ${formatVNDC(pendingRewards)}`)

  const tx = await (staking as any).unstake()
  console.log(`\nTx hash  : ${tx.hash}`)
  const receipt = await tx.wait()
  console.log(`Block    : ${receipt.blockNumber}`)

  console.log(`✅ Unstaked ${formatVNDC(stakeInfo.amount)} + rewards`)
  hr()
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})

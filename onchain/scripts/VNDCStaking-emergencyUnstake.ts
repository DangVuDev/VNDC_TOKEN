/**
 * VNDCStaking-emergencyUnstake.ts
 * Emergency withdraw staked tokens without rewards (forfeits all rewards).
 * Use only when normal unstake is blocked.
 *
 * Usage:
 *   npx hardhat run scripts/VNDCStaking-emergencyUnstake.ts --network localhost
 */
import { ethers, network } from "hardhat"
import { requireAddress, formatVNDC, hr } from "./_utils"

async function main() {
  hr("VNDCStaking — Emergency Unstake")

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

  console.log(`⚠️  WARNING: Emergency unstake forfeits ALL pending rewards!`)
  console.log(`   Staked: ${formatVNDC(stakeInfo.amount)}`)

  const pending = await (staking as any).calculatePendingRewards(signer.address)
  console.log(`   Forfeited rewards: ${formatVNDC(pending)}`)

  const tx = await (staking as any).emergencyUnstake()
  console.log(`\nTx hash  : ${tx.hash}`)
  const receipt = await tx.wait()
  console.log(`Block    : ${receipt.blockNumber}`)

  console.log(`✅ Emergency unstake complete. Principal ${formatVNDC(stakeInfo.amount)} returned.`)
  hr()
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})

/**
 * VNDCStaking-info.ts
 * Read staking contract state and optionally show a specific user's stake.
 *
 * Env vars (optional):
 *   CHECK_WALLET  — Address to check stake info for
 *
 * Usage:
 *   npx hardhat run scripts/VNDCStaking-info.ts --network localhost
 *   CHECK_WALLET=0x... npx hardhat run scripts/VNDCStaking-info.ts --network localhost
 */
import { ethers, network } from "hardhat"
import { requireAddress, envOptional, formatVNDC, formatDuration, hr } from "./_utils"

async function main() {
  hr("VNDCStaking — Info")

  const stakingAddress = requireAddress(network.name, "VNDCStaking")
  const staking = await ethers.getContractAt("VNDCStaking", stakingAddress)

  const [rewardRate, minStake, totalStaked, totalRewards] = await Promise.all([
    (staking as any).rewardRate(),
    (staking as any).minStakeAmount(),
    (staking as any).totalStaked(),
    (staking as any).totalRewardsDistributed(),
  ])

  console.log(`Contract           : ${stakingAddress}`)
  console.log(`Network            : ${network.name}`)
  console.log(`Reward rate        : ${rewardRate} bps (${Number(rewardRate) / 100}% APY)`)
  console.log(`Min stake amount   : ${formatVNDC(minStake)}`)
  console.log(`Total staked       : ${formatVNDC(totalStaked)}`)
  console.log(`Total rewards paid : ${formatVNDC(totalRewards)}`)

  console.log(`\nStaking tiers:`)
  const tiers = [90, 180, 365, 730]
  for (const days of tiers) {
    const multiplier = await (staking as any).stakingMultipliers(days * 86400)
    console.log(`  ${days} days: ${multiplier} bps multiplier (${Number(multiplier) / 100}% effective)`)
  }

  const checkWallet = envOptional("CHECK_WALLET", "")
  if (checkWallet) {
    const stakeInfo = await (staking as any).getStake(checkWallet)
    const pending = await (staking as any).calculatePendingRewards(checkWallet)
    const timeToUnlock = await (staking as any).getTimeToUnlock(checkWallet)

    console.log(`\n── Wallet: ${checkWallet}`)
    if (stakeInfo.amount === 0n) {
      console.log(`No active stake.`)
    } else {
      const startTime = new Date(Number(stakeInfo.startTime) * 1000).toISOString()
      const unlockTime = new Date((Number(stakeInfo.startTime) + Number(stakeInfo.duration)) * 1000).toISOString()
      console.log(`Staked          : ${formatVNDC(stakeInfo.amount)}`)
      console.log(`Duration        : ${formatDuration(Number(stakeInfo.duration))}`)
      console.log(`Start time      : ${startTime}`)
      console.log(`Unlock time     : ${unlockTime}`)
      console.log(`Time to unlock  : ${timeToUnlock > 0n ? formatDuration(Number(timeToUnlock)) : "UNLOCKED"}`)
      console.log(`Pending rewards : ${formatVNDC(pending)}`)
    }
  }

  hr()
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})

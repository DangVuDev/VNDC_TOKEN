/**
 * VNDCStaking-stake.ts
 * Stake VNDC tokens into the staking contract.
 * Requires: caller approved VNDCStaking to spend at least AMOUNT of VNDC.
 *
 * Env vars (required):
 *   AMOUNT    — Amount in VNDC to stake (e.g. "1000")
 *   DURATION  — Lock duration in days: 90 | 180 | 365 | 730
 *
 * Usage:
 *   AMOUNT=1000 DURATION=90 npx hardhat run scripts/VNDCStaking-stake.ts --network localhost
 */
import { ethers, network } from "hardhat"
import { requireAddress, env, parseVNDC, formatVNDC, hr } from "./_utils"

const DURATION_DAYS: Record<string, number> = {
  "90": 90 * 86400,
  "180": 180 * 86400,
  "365": 365 * 86400,
  "730": 730 * 86400,
}

async function main() {
  hr("VNDCStaking — Stake")

  const [signer] = await ethers.getSigners()
  const amount = parseVNDC(env("AMOUNT"))
  const durationDays = env("DURATION")
  const durationSecs = DURATION_DAYS[durationDays]
  if (!durationSecs) {
    throw new Error(`Invalid DURATION=${durationDays}. Valid values: 90, 180, 365, 730`)
  }

  const tokenAddress = requireAddress(network.name, "VNDCToken")
  const stakingAddress = requireAddress(network.name, "VNDCStaking")

  const token = await ethers.getContractAt("VNDCToken", tokenAddress, signer)
  const staking = await ethers.getContractAt("VNDCStaking", stakingAddress, signer)

  console.log(`Staking contract : ${stakingAddress}`)
  console.log(`Signer           : ${signer.address}`)
  console.log(`Amount           : ${formatVNDC(amount)}`)
  console.log(`Duration         : ${durationDays} days (${durationSecs}s)`)

  // Check and set allowance
  const allowance = await (token as any).allowance(signer.address, stakingAddress)
  if (allowance < amount) {
    console.log(`\nApproving ${formatVNDC(amount)}...`)
    const approveTx = await (token as any).approve(stakingAddress, amount)
    await approveTx.wait()
    console.log(`✅ Approved`)
  }

  const tx = await (staking as any).stake(amount, durationSecs)
  console.log(`\nTx hash  : ${tx.hash}`)
  const receipt = await tx.wait()
  console.log(`Block    : ${receipt.blockNumber}`)

  const stakeInfo = await (staking as any).getStake(signer.address)
  console.log(`\n✅ Staked ${formatVNDC(amount)} for ${durationDays} days`)
  console.log(`   Start time: ${new Date(Number(stakeInfo.startTime) * 1000).toISOString()}`)
  console.log(`   Unlock at : ${new Date((Number(stakeInfo.startTime) + Number(stakeInfo.duration)) * 1000).toISOString()}`)
  hr()
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})

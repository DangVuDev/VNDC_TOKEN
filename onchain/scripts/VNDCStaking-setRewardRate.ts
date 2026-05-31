/**
 * VNDCStaking-setRewardRate.ts
 * Update the annual reward rate (requires ADMIN_ROLE).
 *
 * Env vars (required):
 *   RATE_BPS  — New reward rate in basis points (e.g. 1000 = 10% APY, max 10000 = 100%)
 *
 * Usage:
 *   RATE_BPS=1200 npx hardhat run scripts/VNDCStaking-setRewardRate.ts --network localhost
 */
import { ethers, network } from "hardhat"
import { requireAddress, env, hr } from "./_utils"

async function main() {
  hr("VNDCStaking — Set Reward Rate")

  const [signer] = await ethers.getSigners()
  const rateBps = Number(env("RATE_BPS"))
  if (rateBps < 0 || rateBps > 10000) {
    throw new Error(`RATE_BPS must be between 0 and 10000. Got: ${rateBps}`)
  }

  const stakingAddress = requireAddress(network.name, "VNDCStaking")
  const staking = await ethers.getContractAt("VNDCStaking", stakingAddress, signer)

  console.log(`Contract : ${stakingAddress}`)
  console.log(`Signer   : ${signer.address}`)

  const currentRate = await (staking as any).rewardRate()
  console.log(`Current rate : ${currentRate} bps (${Number(currentRate) / 100}% APY)`)
  console.log(`New rate     : ${rateBps} bps (${rateBps / 100}% APY)`)

  const tx = await (staking as any).setRewardRate(rateBps)
  console.log(`\nTx hash  : ${tx.hash}`)
  await tx.wait()

  console.log(`✅ Reward rate updated to ${rateBps} bps (${rateBps / 100}% APY)`)
  hr()
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})

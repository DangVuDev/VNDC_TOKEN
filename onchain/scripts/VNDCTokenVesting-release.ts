/**
 * VNDCTokenVesting-release.ts
 * Release vested tokens for a schedule (callable by anyone — sends to beneficiary).
 *
 * Env vars (required):
 *   SCHEDULE_ID  — bytes32 schedule ID (from VNDCTokenVesting-createSchedule.ts output)
 *
 * Usage:
 *   SCHEDULE_ID=0x... npx hardhat run scripts/VNDCTokenVesting-release.ts --network localhost
 */
import { ethers, network } from "hardhat"
import { requireAddress, env, formatVNDC, hr } from "./_utils"

async function main() {
  hr("VNDCTokenVesting — Release Vested Tokens")

  const [signer] = await ethers.getSigners()
  const scheduleId = env("SCHEDULE_ID")

  const vestingAddress = requireAddress(network.name, "VNDCTokenVesting")
  const vesting = await ethers.getContractAt("VNDCTokenVesting", vestingAddress, signer)

  console.log(`Contract     : ${vestingAddress}`)
  console.log(`Signer       : ${signer.address}`)
  console.log(`Schedule ID  : ${scheduleId}`)

  const schedule = await (vesting as any).getVestingSchedule(scheduleId)
  if (schedule.beneficiary === ethers.ZeroAddress) {
    throw new Error(`Schedule ${scheduleId} not found.`)
  }
  if (schedule.revoked) {
    throw new Error(`Schedule ${scheduleId} has been revoked.`)
  }

  const releasable = await (vesting as any).calculateReleasableAmount(scheduleId)
  console.log(`Beneficiary  : ${schedule.beneficiary}`)
  console.log(`Total amount : ${formatVNDC(schedule.amount)}`)
  console.log(`Released     : ${formatVNDC(schedule.released)}`)
  console.log(`Releasable   : ${formatVNDC(releasable)}`)

  if (releasable === 0n) {
    console.log(`\n⚠️  Nothing to release yet (cliff may not have passed).`)
    return
  }

  const tx = await (vesting as any).releaseVestedTokens(scheduleId)
  console.log(`\nTx hash  : ${tx.hash}`)
  await tx.wait()

  console.log(`✅ Released ${formatVNDC(releasable)} to ${schedule.beneficiary}`)
  hr()
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})

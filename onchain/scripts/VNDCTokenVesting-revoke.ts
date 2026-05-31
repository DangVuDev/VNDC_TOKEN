/**
 * VNDCTokenVesting-revoke.ts
 * Revoke a vesting schedule (returns unvested tokens to caller).
 * Requires: schedule must be marked as revocable.
 *
 * Env vars (required):
 *   SCHEDULE_ID  — bytes32 schedule ID to revoke
 *
 * Usage:
 *   SCHEDULE_ID=0x... npx hardhat run scripts/VNDCTokenVesting-revoke.ts --network localhost
 */
import { ethers, network } from "hardhat"
import { requireAddress, env, formatVNDC, hr } from "./_utils"

async function main() {
  hr("VNDCTokenVesting — Revoke Schedule")

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
  if (!schedule.revocable) {
    throw new Error(`Schedule ${scheduleId} is not revocable.`)
  }
  if (schedule.revoked) {
    throw new Error(`Schedule ${scheduleId} is already revoked.`)
  }

  const unvested = schedule.amount - schedule.released
  console.log(`Beneficiary  : ${schedule.beneficiary}`)
  console.log(`Total amount : ${formatVNDC(schedule.amount)}`)
  console.log(`Released     : ${formatVNDC(schedule.released)}`)
  console.log(`Unvested     : ${formatVNDC(unvested)} (will be returned)`)

  const tx = await (vesting as any).revokeVestingSchedule(scheduleId)
  console.log(`\nTx hash  : ${tx.hash}`)
  await tx.wait()

  console.log(`✅ Schedule revoked. ${formatVNDC(unvested)} returned.`)
  hr()
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})

/**
 * VNDCTokenVesting-info.ts
 * Show vesting contract state and a user's schedules.
 *
 * Env vars (optional):
 *   CHECK_WALLET   — Address to list vesting schedules for
 *   SCHEDULE_ID    — Specific schedule ID to inspect
 *
 * Usage:
 *   CHECK_WALLET=0x... npx hardhat run scripts/VNDCTokenVesting-info.ts --network localhost
 */
import { ethers, network } from "hardhat"
import { requireAddress, envOptional, formatVNDC, hr } from "./_utils"

async function main() {
  hr("VNDCTokenVesting — Info")

  const vestingAddress = requireAddress(network.name, "VNDCTokenVesting")
  const vesting = await ethers.getContractAt("VNDCTokenVesting", vestingAddress)

  const totalVested = await (vesting as any).totalVested()
  const count = await (vesting as any).getVestingSchedulesCount()

  console.log(`Contract         : ${vestingAddress}`)
  console.log(`Network          : ${network.name}`)
  console.log(`Total vested     : ${formatVNDC(totalVested)}`)
  console.log(`Total schedules  : ${count}`)

  const checkWallet = envOptional("CHECK_WALLET", "")
  if (checkWallet) {
    const scheduleIds: string[] = await (vesting as any).getUserVestingSchedules(checkWallet)
    console.log(`\n── Wallet: ${checkWallet} (${scheduleIds.length} schedule(s))`)

    for (const id of scheduleIds) {
      const s = await (vesting as any).getVestingSchedule(id)
      const releasable = s.revoked ? 0n : await (vesting as any).calculateReleasableAmount(id)
      const unvested = s.amount - s.released

      console.log(`\n  Schedule: ${id}`)
      console.log(`  Status      : ${s.revoked ? "REVOKED" : "active"}`)
      console.log(`  Amount      : ${formatVNDC(s.amount)}`)
      console.log(`  Released    : ${formatVNDC(s.released)}`)
      console.log(`  Releasable  : ${formatVNDC(releasable)}`)
      console.log(`  Unvested    : ${formatVNDC(unvested)}`)
      console.log(`  Revocable   : ${s.revocable}`)
      console.log(`  Cliff end   : ${new Date(Number(s.cliffTime) * 1000).toISOString()}`)
      console.log(`  Fully vests : ${new Date((Number(s.startTime) + Number(s.duration)) * 1000).toISOString()}`)
    }
  }

  const scheduleId = envOptional("SCHEDULE_ID", "")
  if (scheduleId) {
    const s = await (vesting as any).getVestingSchedule(scheduleId)
    console.log(`\n── Schedule: ${scheduleId}`)
    console.log(`  Beneficiary : ${s.beneficiary}`)
    console.log(`  Amount      : ${formatVNDC(s.amount)}`)
    console.log(`  Released    : ${formatVNDC(s.released)}`)
    console.log(`  Revocable   : ${s.revocable}`)
    console.log(`  Revoked     : ${s.revoked}`)
  }

  hr()
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})

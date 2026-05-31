/**
 * VNDCTokenVesting-createSchedule.ts
 * Create a vesting schedule for a beneficiary.
 * Caller must approve VNDCTokenVesting contract to spend the AMOUNT first.
 *
 * Env vars (required):
 *   BENEFICIARY      — Address receiving vested tokens
 *   AMOUNT           — Total amount in VNDC to vest
 *   CLIFF_DAYS       — Cliff period in days (tokens not accessible until after cliff)
 *   VESTING_DAYS     — Total vesting duration in days
 *
 * Env vars (optional):
 *   START_OFFSET     — Start delay in seconds from now (default: 0 = now)
 *   REVOCABLE        — "true" or "false" (default: "true")
 *
 * Usage:
 *   BENEFICIARY=0x... AMOUNT=10000 CLIFF_DAYS=30 VESTING_DAYS=365 \
 *     npx hardhat run scripts/VNDCTokenVesting-createSchedule.ts --network localhost
 */
import { ethers, network } from "hardhat"
import { requireAddress, env, envOptional, parseVNDC, formatVNDC, shortAddr, hr } from "./_utils"

async function main() {
  hr("VNDCTokenVesting — Create Schedule")

  const [signer] = await ethers.getSigners()
  const beneficiary = env("BENEFICIARY")
  const amount = parseVNDC(env("AMOUNT"))
  const cliffDays = Number(env("CLIFF_DAYS"))
  const vestingDays = Number(env("VESTING_DAYS"))
  const startOffset = Number(envOptional("START_OFFSET", "0"))
  const revocable = envOptional("REVOCABLE", "true") === "true"

  const startTime = Math.floor(Date.now() / 1000) + startOffset
  const cliffDuration = cliffDays * 86400
  const vestingDuration = vestingDays * 86400

  if (cliffDuration > vestingDuration) {
    throw new Error(`CLIFF_DAYS (${cliffDays}) must be <= VESTING_DAYS (${vestingDays})`)
  }

  const tokenAddress = requireAddress(network.name, "VNDCToken")
  const vestingAddress = requireAddress(network.name, "VNDCTokenVesting")

  const token = await ethers.getContractAt("VNDCToken", tokenAddress, signer)
  const vesting = await ethers.getContractAt("VNDCTokenVesting", vestingAddress, signer)

  console.log(`Vesting contract : ${vestingAddress}`)
  console.log(`Signer           : ${signer.address}`)
  console.log(`Beneficiary      : ${beneficiary}`)
  console.log(`Amount           : ${formatVNDC(amount)}`)
  console.log(`Cliff            : ${cliffDays} days`)
  console.log(`Vesting duration : ${vestingDays} days`)
  console.log(`Revocable        : ${revocable}`)
  console.log(`Start            : ${new Date(startTime * 1000).toISOString()}`)

  // Approve
  const allowance = await (token as any).allowance(signer.address, vestingAddress)
  if (allowance < amount) {
    console.log(`\nApproving ${formatVNDC(amount)}...`)
    const approveTx = await (token as any).approve(vestingAddress, amount)
    await approveTx.wait()
    console.log(`✅ Approved`)
  }

  const tx = await (vesting as any).createVestingSchedule(
    beneficiary,
    amount,
    startTime,
    cliffDuration,
    vestingDuration,
    revocable
  )
  console.log(`\nTx hash  : ${tx.hash}`)
  const receipt = await tx.wait()
  console.log(`Block    : ${receipt.blockNumber}`)

  // Extract scheduleId from event
  const iface = (vesting as any).interface
  const log = receipt.logs.find((l: any) => {
    try { iface.parseLog(l); return true } catch { return false }
  })
  if (log) {
    const parsed = iface.parseLog(log)
    const scheduleId = parsed?.args?.[0]
    if (scheduleId) console.log(`Schedule ID: ${scheduleId}`)
  }

  console.log(`\n✅ Vesting schedule created for ${shortAddr(beneficiary)}`)
  console.log(`   Cliff ends : ${new Date((startTime + cliffDuration) * 1000).toISOString()}`)
  console.log(`   Fully vested: ${new Date((startTime + vestingDuration) * 1000).toISOString()}`)
  hr()
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})

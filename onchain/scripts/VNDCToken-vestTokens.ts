/**
 * VNDCToken-vestTokens.ts
 * Lock tokens in vesting for a holder (requires DEFAULT_ADMIN_ROLE).
 * Holder must already have sufficient balance.
 *
 * Env vars (required):
 *   HOLDER        — Address of the token holder to vest
 *   AMOUNT        — Amount in VNDC to lock (e.g. "5000")
 *   RELEASE_TIME  — Unix timestamp when tokens unlock (e.g. "1800000000")
 *                   Or use RELEASE_DAYS to set relative from now.
 *
 * Env vars (optional):
 *   RELEASE_DAYS  — Days from now until release (overrides RELEASE_TIME if set)
 *
 * Usage:
 *   HOLDER=0x... AMOUNT=5000 RELEASE_DAYS=90 npx hardhat run scripts/VNDCToken-vestTokens.ts --network localhost
 */
import { ethers, network } from "hardhat"
import { requireAddress, env, envOptional, parseVNDC, formatVNDC, shortAddr, hr } from "./_utils"

async function main() {
  hr("VNDCToken — Vest Tokens")

  const [signer] = await ethers.getSigners()
  const holder = env("HOLDER")
  const amount = parseVNDC(env("AMOUNT"))

  let releaseTime: number
  const releaseDays = envOptional("RELEASE_DAYS", "")
  if (releaseDays) {
    releaseTime = Math.floor(Date.now() / 1000) + Number(releaseDays) * 86400
    console.log(`Release  : ${releaseDays} days from now (${new Date(releaseTime * 1000).toISOString()})`)
  } else {
    releaseTime = Number(env("RELEASE_TIME"))
    console.log(`Release  : ${new Date(releaseTime * 1000).toISOString()} (ts: ${releaseTime})`)
  }

  const tokenAddress = requireAddress(network.name, "VNDCToken")
  const token = await ethers.getContractAt("VNDCToken", tokenAddress, signer)

  console.log(`Contract : ${tokenAddress}`)
  console.log(`Signer   : ${signer.address}`)
  console.log(`Holder   : ${holder}`)
  console.log(`Amount   : ${formatVNDC(amount)}`)

  const tx = await (token as any).vestTokens(holder, amount, releaseTime)
  console.log(`\nTx hash  : ${tx.hash}`)
  await tx.wait()

  const info = await (token as any).vestingInfo(holder)
  console.log(`\n✅ Vesting set for ${shortAddr(holder)}`)
  console.log(`   Locked  : ${formatVNDC(info.amount)}`)
  console.log(`   Unlocks : ${new Date(Number(info.releaseTime) * 1000).toISOString()}`)
  hr()
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})

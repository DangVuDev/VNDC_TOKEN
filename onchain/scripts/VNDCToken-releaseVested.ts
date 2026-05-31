/**
 * VNDCToken-releaseVested.ts
 * Release locked vesting tokens for a holder (callable by anyone after unlock time).
 *
 * Env vars (required):
 *   HOLDER  — Address of the vesting holder to release tokens for
 *
 * Usage:
 *   HOLDER=0x... npx hardhat run scripts/VNDCToken-releaseVested.ts --network localhost
 */
import { ethers, network } from "hardhat"
import { requireAddress, env, formatVNDC, shortAddr, hr } from "./_utils"

async function main() {
  hr("VNDCToken — Release Vested Tokens")

  const [signer] = await ethers.getSigners()
  const holder = env("HOLDER")

  const tokenAddress = requireAddress(network.name, "VNDCToken")
  const token = await ethers.getContractAt("VNDCToken", tokenAddress, signer)

  console.log(`Contract : ${tokenAddress}`)
  console.log(`Signer   : ${signer.address}`)
  console.log(`Holder   : ${holder}`)

  const info = await (token as any).vestingInfo(holder)
  if (info.amount === 0n) {
    console.log(`⚠️  No vesting schedule found for ${shortAddr(holder)}.`)
    return
  }

  const now = Math.floor(Date.now() / 1000)
  const unlockTime = Number(info.releaseTime)
  if (now < unlockTime) {
    const remaining = unlockTime - now
    const days = Math.floor(remaining / 86400)
    const hours = Math.floor((remaining % 86400) / 3600)
    console.log(`⚠️  Tokens still locked. Unlocks in ${days}d ${hours}h`)
    console.log(`   Amount: ${formatVNDC(info.amount)}`)
    return
  }

  console.log(`Locked amount: ${formatVNDC(info.amount)}`)

  const tx = await (token as any).releaseVested(holder)
  console.log(`\nTx hash  : ${tx.hash}`)
  await tx.wait()

  console.log(`✅ Released ${formatVNDC(info.amount)} for ${shortAddr(holder)}`)
  hr()
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})

/**
 * VNDCToken-pause.ts
 * Pause the VNDCToken contract (requires PAUSER_ROLE).
 *
 * Usage:
 *   npx hardhat run scripts/VNDCToken-pause.ts --network localhost
 */
import { ethers, network } from "hardhat"
import { requireAddress, hr } from "./_utils"

async function main() {
  hr("VNDCToken — Pause")

  const [signer] = await ethers.getSigners()
  const tokenAddress = requireAddress(network.name, "VNDCToken")
  const token = await ethers.getContractAt("VNDCToken", tokenAddress, signer)

  console.log(`Contract : ${tokenAddress}`)
  console.log(`Signer   : ${signer.address}`)

  const already = await (token as any).paused()
  if (already) {
    console.log("⚠️  Contract is already paused.")
    return
  }

  const tx = await (token as any).pause()
  console.log(`\nTx hash  : ${tx.hash}`)
  await tx.wait()

  console.log(`✅ VNDCToken paused.`)
  hr()
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})

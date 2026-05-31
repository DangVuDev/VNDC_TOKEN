/**
 * VNDCToken-unpause.ts
 * Unpause the VNDCToken contract (requires PAUSER_ROLE).
 *
 * Usage:
 *   npx hardhat run scripts/VNDCToken-unpause.ts --network localhost
 */
import { ethers, network } from "hardhat"
import { requireAddress, hr } from "./_utils"

async function main() {
  hr("VNDCToken — Unpause")

  const [signer] = await ethers.getSigners()
  const tokenAddress = requireAddress(network.name, "VNDCToken")
  const token = await ethers.getContractAt("VNDCToken", tokenAddress, signer)

  console.log(`Contract : ${tokenAddress}`)
  console.log(`Signer   : ${signer.address}`)

  const already = await (token as any).paused()
  if (!already) {
    console.log("⚠️  Contract is not paused.")
    return
  }

  const tx = await (token as any).unpause()
  console.log(`\nTx hash  : ${tx.hash}`)
  await tx.wait()

  console.log(`✅ VNDCToken unpaused.`)
  hr()
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})

/**
 * MarketplaceManager-grantOperatorRole.ts
 * Grant OPERATOR_ROLE to an address (requires DEFAULT_ADMIN_ROLE).
 *
 * Env vars (required):
 *   TO  — Address to grant OPERATOR_ROLE
 *
 * Usage:
 *   TO=0x... npx hardhat run scripts/MarketplaceManager-grantOperatorRole.ts --network localhost
 */
import { ethers, network } from "hardhat"
import { requireAddress, env, shortAddr, hr } from "./_utils"

async function main() {
  hr("MarketplaceManager — Grant Operator Role")

  const [signer] = await ethers.getSigners()
  const to = env("TO")

  const mpAddress = requireAddress(network.name, "MarketplaceManager")
  const mp = await ethers.getContractAt("MarketplaceManager", mpAddress, signer)
  const OPERATOR_ROLE: string = await (mp as any).OPERATOR_ROLE()

  console.log(`Marketplace     : ${mpAddress}`)
  console.log(`Signer          : ${signer.address}`)
  console.log(`OPERATOR_ROLE   : ${OPERATOR_ROLE}`)
  console.log(`Granting to     : ${shortAddr(to)}`)

  const hasRole = await (mp as any).hasRole(OPERATOR_ROLE, to)
  if (hasRole) {
    console.log(`ℹ️  ${shortAddr(to)} already has OPERATOR_ROLE`)
    return
  }

  const tx = await (mp as any).grantRole(OPERATOR_ROLE, to)
  console.log(`\nTx hash  : ${tx.hash}`)
  await tx.wait()

  console.log(`✅ OPERATOR_ROLE granted to ${shortAddr(to)}`)
  hr()
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})

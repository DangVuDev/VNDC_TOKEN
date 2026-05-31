/**
 * FundingManager-grantOperatorRole.ts
 * Grant OPERATOR_ROLE to an address (requires DEFAULT_ADMIN_ROLE).
 *
 * Env vars (required):
 *   TO  — Address to grant OPERATOR_ROLE
 *
 * Usage:
 *   TO=0x... npx hardhat run scripts/FundingManager-grantOperatorRole.ts --network localhost
 */
import { ethers, network } from "hardhat"
import { requireAddress, env, shortAddr, hr } from "./_utils"

async function main() {
  hr("FundingManager — Grant Operator Role")

  const [signer] = await ethers.getSigners()
  const to = env("TO")

  const fmAddress = requireAddress(network.name, "FundingManager")
  const fm = await ethers.getContractAt("FundingManager", fmAddress, signer)
  const OPERATOR_ROLE: string = await (fm as any).OPERATOR_ROLE()

  console.log(`FundingManager  : ${fmAddress}`)
  console.log(`Signer          : ${signer.address}`)
  console.log(`OPERATOR_ROLE   : ${OPERATOR_ROLE}`)
  console.log(`Granting to     : ${shortAddr(to)}`)

  const hasRole = await (fm as any).hasRole(OPERATOR_ROLE, to)
  if (hasRole) {
    console.log(`ℹ️  ${shortAddr(to)} already has OPERATOR_ROLE`)
    return
  }

  const tx = await (fm as any).grantRole(OPERATOR_ROLE, to)
  console.log(`\nTx hash  : ${tx.hash}`)
  await tx.wait()

  console.log(`✅ OPERATOR_ROLE granted to ${shortAddr(to)}`)
  hr()
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})

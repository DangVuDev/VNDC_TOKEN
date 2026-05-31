/**
 * VNDCToken-grantRole.ts
 * Grant a role to an address on VNDCToken (requires DEFAULT_ADMIN_ROLE).
 *
 * Env vars (required):
 *   ROLE    — Role name: MINTER_ROLE | PAUSER_ROLE | DEFAULT_ADMIN_ROLE
 *   TO      — Address to grant the role to
 *
 * Usage:
 *   ROLE=MINTER_ROLE TO=0xBackendWallet npx hardhat run scripts/VNDCToken-grantRole.ts --network localhost
 */
import { ethers, network } from "hardhat"
import { requireAddress, env, shortAddr, hr } from "./_utils"

const ROLE_MAP: Record<string, string> = {
  DEFAULT_ADMIN_ROLE: "0x0000000000000000000000000000000000000000000000000000000000000000",
  MINTER_ROLE: ethers.keccak256(ethers.toUtf8Bytes("MINTER_ROLE")),
  PAUSER_ROLE: ethers.keccak256(ethers.toUtf8Bytes("PAUSER_ROLE")),
}

async function main() {
  hr("VNDCToken — Grant Role")

  const [signer] = await ethers.getSigners()
  const roleName = env("ROLE")
  const to = env("TO")

  const roleHash = ROLE_MAP[roleName]
  if (!roleHash) {
    throw new Error(`Unknown role: ${roleName}. Valid values: ${Object.keys(ROLE_MAP).join(", ")}`)
  }

  const tokenAddress = requireAddress(network.name, "VNDCToken")
  const token = await ethers.getContractAt("VNDCToken", tokenAddress, signer)

  console.log(`Contract : ${tokenAddress}`)
  console.log(`Signer   : ${signer.address}`)
  console.log(`Role     : ${roleName} (${roleHash})`)
  console.log(`To       : ${to}`)

  const alreadyHas = await (token as any).hasRole(roleHash, to)
  if (alreadyHas) {
    console.log(`⚠️  ${shortAddr(to)} already has ${roleName}.`)
    return
  }

  const tx = await (token as any).grantRole(roleHash, to)
  console.log(`\nTx hash  : ${tx.hash}`)
  await tx.wait()

  console.log(`✅ Granted ${roleName} to ${shortAddr(to)}`)
  hr()
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})

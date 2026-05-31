/**
 * VNDCToken-revokeRole.ts
 * Revoke a role from an address on VNDCToken (requires DEFAULT_ADMIN_ROLE).
 *
 * Env vars (required):
 *   ROLE    — Role name: MINTER_ROLE | PAUSER_ROLE | DEFAULT_ADMIN_ROLE
 *   FROM    — Address to revoke the role from
 *
 * Usage:
 *   ROLE=MINTER_ROLE FROM=0xOldMinter npx hardhat run scripts/VNDCToken-revokeRole.ts --network localhost
 */
import { ethers, network } from "hardhat"
import { requireAddress, env, shortAddr, hr } from "./_utils"

const ROLE_MAP: Record<string, string> = {
  DEFAULT_ADMIN_ROLE: "0x0000000000000000000000000000000000000000000000000000000000000000",
  MINTER_ROLE: ethers.keccak256(ethers.toUtf8Bytes("MINTER_ROLE")),
  PAUSER_ROLE: ethers.keccak256(ethers.toUtf8Bytes("PAUSER_ROLE")),
}

async function main() {
  hr("VNDCToken — Revoke Role")

  const [signer] = await ethers.getSigners()
  const roleName = env("ROLE")
  const from = env("FROM")

  const roleHash = ROLE_MAP[roleName]
  if (!roleHash) {
    throw new Error(`Unknown role: ${roleName}. Valid values: ${Object.keys(ROLE_MAP).join(", ")}`)
  }

  const tokenAddress = requireAddress(network.name, "VNDCToken")
  const token = await ethers.getContractAt("VNDCToken", tokenAddress, signer)

  console.log(`Contract : ${tokenAddress}`)
  console.log(`Signer   : ${signer.address}`)
  console.log(`Role     : ${roleName} (${roleHash})`)
  console.log(`From     : ${from}`)

  const hasIt = await (token as any).hasRole(roleHash, from)
  if (!hasIt) {
    console.log(`⚠️  ${shortAddr(from)} does not have ${roleName}.`)
    return
  }

  const tx = await (token as any).revokeRole(roleHash, from)
  console.log(`\nTx hash  : ${tx.hash}`)
  await tx.wait()

  console.log(`✅ Revoked ${roleName} from ${shortAddr(from)}`)
  hr()
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})

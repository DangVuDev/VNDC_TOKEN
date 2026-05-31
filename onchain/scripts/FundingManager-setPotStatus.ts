/**
 * FundingManager-setPotStatus.ts
 * Update the status of a funding pot (OPERATOR_ROLE).
 * Status: 0=DRAFT, 1=ACTIVE, 2=CLOSED, 3=CANCELLED
 *
 * Env vars (required):
 *   POT_ID  — bytes32 pot ID
 *   STATUS  — New status: DRAFT | ACTIVE | CLOSED | CANCELLED
 *
 * Env vars (optional):
 *   POT_NAME — Human-readable pot name to hash into POT_ID (overrides POT_ID)
 *
 * Usage:
 *   POT_NAME="school-fund-2026" STATUS=CLOSED \
 *     npx hardhat run scripts/FundingManager-setPotStatus.ts --network localhost
 */
import { ethers, network } from "hardhat"
import { requireAddress, env, envOptional, formatVNDC, hr } from "./_utils"

const STATUS_MAP: Record<string, number> = {
  DRAFT: 0,
  ACTIVE: 1,
  CLOSED: 2,
  CANCELLED: 3,
}

const STATUS_NAME = ["DRAFT", "ACTIVE", "CLOSED", "CANCELLED"]

async function main() {
  hr("FundingManager — Set Pot Status")

  const [signer] = await ethers.getSigners()
  const potName = envOptional("POT_NAME", "")
  const potId = potName
    ? ethers.keccak256(ethers.toUtf8Bytes(potName))
    : env("POT_ID")

  const statusStr = env("STATUS").toUpperCase()
  const status = STATUS_MAP[statusStr]
  if (status === undefined) {
    throw new Error(`Invalid STATUS="${statusStr}". Valid: DRAFT, ACTIVE, CLOSED, CANCELLED`)
  }

  const fmAddress = requireAddress(network.name, "FundingManager")
  const fm = await ethers.getContractAt("FundingManager", fmAddress, signer)

  console.log(`FundingManager : ${fmAddress}`)
  console.log(`Signer         : ${signer.address}`)
  console.log(`Pot ID         : ${potId}`)

  const pot = await (fm as any).pots(potId)
  if (pot.id === ethers.ZeroHash) {
    throw new Error(`Pot ${potId} not found.`)
  }

  console.log(`Current status : ${STATUS_NAME[Number(pot.status)]}`)
  console.log(`New status     : ${statusStr}`)
  console.log(`Available      : ${formatVNDC(pot.availableBalance)}`)

  const tx = await (fm as any).setPotStatus(potId, status)
  console.log(`\nTx hash  : ${tx.hash}`)
  await tx.wait()

  console.log(`✅ Pot status updated to ${statusStr}`)
  hr()
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})

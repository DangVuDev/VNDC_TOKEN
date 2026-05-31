/**
 * FundingManager-createPot.ts
 * Create a new funding pot (requires OPERATOR_ROLE).
 *
 * Env vars (required):
 *   POT_NAME      — Human-readable name (hashed into POT_ID)
 *   POT_OWNER     — Pot owner address (can spend)
 *   TARGET        — Target funding amount in VNDC
 *   CATEGORY      — Category string (e.g. "education", "infrastructure")
 *   TITLE         — Display title for the pot
 *
 * Env vars (optional):
 *   POT_ID        — Override auto-generated ID
 *   STARTS_AT     — Unix timestamp start (0 = no restriction)
 *   ENDS_AT       — Unix timestamp end (0 = no restriction)
 *   DEPUTIES      — Comma-separated additional deputy addresses
 *
 * Usage:
 *   POT_NAME="school-fund-2026" POT_OWNER=0x... TARGET=100000 CATEGORY=education TITLE="School Fund 2026" \
 *     npx hardhat run scripts/FundingManager-createPot.ts --network localhost
 */
import { ethers, network } from "hardhat"
import { requireAddress, env, envOptional, parseVNDC, formatVNDC, shortAddr, hr } from "./_utils"

async function main() {
  hr("FundingManager — Create Pot")

  const [signer] = await ethers.getSigners()
  const potName = envOptional("POT_NAME", "")
  const potId = potName
    ? ethers.keccak256(ethers.toUtf8Bytes(potName))
    : env("POT_ID")

  const potOwner = env("POT_OWNER")
  const target = parseVNDC(env("TARGET"))
  const category = env("CATEGORY")
  const title = env("TITLE")
  const startsAt = Number(envOptional("STARTS_AT", "0"))
  const endsAt = Number(envOptional("ENDS_AT", "0"))
  const deputiesStr = envOptional("DEPUTIES", "")
  const deputies = deputiesStr ? deputiesStr.split(",").map((s) => s.trim()) : []

  const fmAddress = requireAddress(network.name, "FundingManager")
  const fm = await ethers.getContractAt("FundingManager", fmAddress, signer)

  console.log(`FundingManager : ${fmAddress}`)
  console.log(`Signer         : ${signer.address}`)
  console.log(`Pot ID         : ${potId}`)
  if (potName) console.log(`Pot name       : ${potName}`)
  console.log(`Owner          : ${potOwner}`)
  console.log(`Target         : ${formatVNDC(target)}`)
  console.log(`Category       : ${category}`)
  console.log(`Title          : ${title}`)
  if (deputies.length) console.log(`Deputies       : ${deputies.join(", ")}`)

  const tx = await (fm as any).createPot(
    potId,
    potOwner,
    target,
    category,
    title,
    deputies,
    startsAt,
    endsAt
  )
  console.log(`\nTx hash  : ${tx.hash}`)
  await tx.wait()

  console.log(`✅ Pot created: ${potId}`)
  console.log(`   Owner: ${shortAddr(potOwner)}, Target: ${formatVNDC(target)}`)
  hr()
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})

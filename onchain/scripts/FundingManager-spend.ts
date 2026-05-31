/**
 * FundingManager-spend.ts
 * Spend VNDC from a pot to a beneficiary (OPERATOR_ROLE, actor must be pot owner or deputy).
 *
 * Env vars (required):
 *   POT_ID      — bytes32 pot ID
 *   ACTOR       — Address of the pot owner/deputy authorizing the spend
 *   BENEFICIARY — Address receiving the funds
 *   AMOUNT      — Amount in VNDC to spend
 *   NOTE        — Description of the spend
 *
 * Env vars (optional):
 *   POT_NAME    — Human-readable pot name to hash into POT_ID (overrides POT_ID)
 *
 * Usage:
 *   POT_NAME="school-fund-2026" ACTOR=0xOwner BENEFICIARY=0x... AMOUNT=1000 NOTE="Office supplies" \
 *     npx hardhat run scripts/FundingManager-spend.ts --network localhost
 */
import { ethers, network } from "hardhat"
import { requireAddress, env, envOptional, parseVNDC, formatVNDC, shortAddr, hr } from "./_utils"

async function main() {
  hr("FundingManager — Spend")

  const [signer] = await ethers.getSigners()
  const potName = envOptional("POT_NAME", "")
  const potId = potName
    ? ethers.keccak256(ethers.toUtf8Bytes(potName))
    : env("POT_ID")

  const actor = env("ACTOR")
  const beneficiary = env("BENEFICIARY")
  const amount = parseVNDC(env("AMOUNT"))
  const note = env("NOTE")

  const fmAddress = requireAddress(network.name, "FundingManager")
  const fm = await ethers.getContractAt("FundingManager", fmAddress, signer)

  console.log(`FundingManager : ${fmAddress}`)
  console.log(`Signer         : ${signer.address}`)
  console.log(`Pot ID         : ${potId}`)
  console.log(`Actor          : ${actor}`)
  console.log(`Beneficiary    : ${beneficiary}`)
  console.log(`Amount         : ${formatVNDC(amount)}`)
  console.log(`Note           : ${note}`)

  const pot = await (fm as any).pots(potId)
  console.log(`Available      : ${formatVNDC(pot.availableBalance)}`)

  if (pot.availableBalance < amount) {
    throw new Error(`Insufficient pot balance: ${formatVNDC(pot.availableBalance)} < ${formatVNDC(amount)}`)
  }

  const tx = await (fm as any).spend(potId, actor, beneficiary, amount, note)
  console.log(`\nTx hash  : ${tx.hash}`)
  await tx.wait()

  const potAfter = await (fm as any).pots(potId)
  console.log(`✅ Spent ${formatVNDC(amount)} → ${shortAddr(beneficiary)}`)
  console.log(`   Remaining balance: ${formatVNDC(potAfter.availableBalance)}`)
  hr()
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})

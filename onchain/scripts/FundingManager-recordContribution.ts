/**
 * FundingManager-recordContribution.ts
 * Record a VNDC contribution to a pot after the token transfer has been confirmed (OPERATOR_ROLE).
 * The token transfer to FundingManager must happen separately via the transfer pipeline.
 *
 * Env vars (required):
 *   POT_ID        — bytes32 pot ID
 *   CONTRIBUTOR   — Address of the contributing wallet
 *   AMOUNT        — Contribution amount in VNDC
 *   TX_HASH       — The tx hash of the confirmed token transfer
 *
 * Env vars (optional):
 *   POT_NAME      — Human-readable pot name to hash into POT_ID (overrides POT_ID)
 *
 * Usage:
 *   POT_NAME="school-fund-2026" CONTRIBUTOR=0x... AMOUNT=500 TX_HASH=0x... \
 *     npx hardhat run scripts/FundingManager-recordContribution.ts --network localhost
 */
import { ethers, network } from "hardhat"
import { requireAddress, env, envOptional, parseVNDC, formatVNDC, shortAddr, hr } from "./_utils"

async function main() {
  hr("FundingManager — Record Contribution")

  const [signer] = await ethers.getSigners()
  const potName = envOptional("POT_NAME", "")
  const potId = potName
    ? ethers.keccak256(ethers.toUtf8Bytes(potName))
    : env("POT_ID")

  const contributor = env("CONTRIBUTOR")
  const amount = parseVNDC(env("AMOUNT"))
  const txHash = env("TX_HASH")

  const fmAddress = requireAddress(network.name, "FundingManager")
  const fm = await ethers.getContractAt("FundingManager", fmAddress, signer)

  console.log(`FundingManager : ${fmAddress}`)
  console.log(`Signer         : ${signer.address}`)
  console.log(`Pot ID         : ${potId}`)
  console.log(`Contributor    : ${contributor}`)
  console.log(`Amount         : ${formatVNDC(amount)}`)
  console.log(`Transfer hash  : ${txHash}`)

  const tx = await (fm as any).recordContribution(potId, contributor, amount, txHash)
  console.log(`\nTx hash  : ${tx.hash}`)
  await tx.wait()

  const pot = await (fm as any).pots(potId)
  console.log(`✅ Contribution recorded: ${formatVNDC(amount)} from ${shortAddr(contributor)}`)
  console.log(`   Pot total contributed : ${formatVNDC(pot.totalContributed)}`)
  console.log(`   Pot available balance : ${formatVNDC(pot.availableBalance)}`)
  hr()
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})

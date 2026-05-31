/**
 * DAOManager-cancelProposal.ts
 * Cancel an active or pending proposal (requires OPERATOR_ROLE).
 *
 * Env vars (required):
 *   PROPOSAL_ID  — bytes32 proposal ID to cancel
 *   REASON       — Reason for cancellation
 *
 * Usage:
 *   PROPOSAL_ID=0x... REASON="Proposal withdrawn by author" \
 *     npx hardhat run scripts/DAOManager-cancelProposal.ts --network localhost
 */
import { ethers, network } from "hardhat"
import { requireAddress, env, hr } from "./_utils"

async function main() {
  hr("DAOManager — Cancel Proposal")

  const [signer] = await ethers.getSigners()
  const proposalId = env("PROPOSAL_ID")
  const reason = env("REASON")

  const daoAddress = requireAddress(network.name, "DAOManager")
  const dao = await ethers.getContractAt("DAOManager", daoAddress, signer)

  console.log(`DAOManager   : ${daoAddress}`)
  console.log(`Signer       : ${signer.address}`)
  console.log(`Proposal ID  : ${proposalId}`)
  console.log(`Reason       : ${reason}`)

  const tx = await (dao as any).cancelProposal(proposalId, reason)
  console.log(`\nTx hash  : ${tx.hash}`)
  await tx.wait()

  console.log(`✅ Proposal cancelled: ${proposalId}`)
  hr()
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})

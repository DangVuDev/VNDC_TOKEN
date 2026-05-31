/**
 * DAOManager-executeProposal.ts
 * Execute a succeeded and queued proposal (requires OPERATOR_ROLE).
 *
 * Env vars (required):
 *   PROPOSAL_ID  — bytes32 proposal ID to execute
 *
 * Usage:
 *   PROPOSAL_ID=0x... npx hardhat run scripts/DAOManager-executeProposal.ts --network localhost
 */
import { ethers, network } from "hardhat"
import { requireAddress, env, hr } from "./_utils"

const STATE_LABELS = [
  "Pending", "Active", "Defeated", "Succeeded",
  "Queued", "Executed", "Cancelled", "Expired"
]

async function main() {
  hr("DAOManager — Execute Proposal")

  const [signer] = await ethers.getSigners()
  const proposalId = env("PROPOSAL_ID")

  const daoAddress = requireAddress(network.name, "DAOManager")
  const dao = await ethers.getContractAt("DAOManager", daoAddress, signer)

  console.log(`DAOManager   : ${daoAddress}`)
  console.log(`Signer       : ${signer.address}`)
  console.log(`Proposal ID  : ${proposalId}`)

  const state = await (dao as any).proposalState(proposalId)
  console.log(`State        : ${STATE_LABELS[Number(state)]} (${state})`)

  if (Number(state) !== 4) {  // 4 = Queued
    console.log(`⚠️  Proposal must be in Queued state to execute. Current state: ${STATE_LABELS[Number(state)]}`)
    if (Number(state) === 3) console.log(`   Run DAOManager-queueProposal first.`)
    return
  }

  const proposal = await (dao as any).proposals(proposalId)
  if (proposal.eta > 0n) {
    const now = Math.floor(Date.now() / 1000)
    if (now < Number(proposal.eta)) {
      console.log(`⚠️  Timelock not expired. Execute after: ${new Date(Number(proposal.eta) * 1000).toISOString()}`)
      return
    }
  }

  const tx = await (dao as any).executeProposal(proposalId)
  console.log(`\nTx hash  : ${tx.hash}`)
  await tx.wait()

  console.log(`✅ Proposal executed: ${proposalId}`)
  hr()
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})

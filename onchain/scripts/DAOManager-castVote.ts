/**
 * DAOManager-castVote.ts
 * Cast a vote on a proposal (requires OPERATOR_ROLE, relayed on behalf of voter).
 *
 * Env vars (required):
 *   PROPOSAL_ID  — bytes32 proposal ID
 *   VOTER        — Address of the voter
 *   SUPPORT      — Vote: 0=Against, 1=For, 2=Abstain
 *   WEIGHT       — Voting weight (e.g. token balance at snapshot)
 *
 * Usage:
 *   PROPOSAL_ID=0x... VOTER=0x... SUPPORT=1 WEIGHT=1000 \
 *     npx hardhat run scripts/DAOManager-castVote.ts --network localhost
 */
import { ethers, network } from "hardhat"
import { requireAddress, env, shortAddr, hr } from "./_utils"

const SUPPORT_LABELS: Record<number, string> = { 0: "Against", 1: "For", 2: "Abstain" }

async function main() {
  hr("DAOManager — Cast Vote")

  const [signer] = await ethers.getSigners()
  const proposalId = env("PROPOSAL_ID")
  const voter = env("VOTER")
  const support = Number(env("SUPPORT"))
  const weight = BigInt(env("WEIGHT"))

  if (![0, 1, 2].includes(support)) {
    throw new Error(`SUPPORT must be 0 (Against), 1 (For), or 2 (Abstain). Got: ${support}`)
  }

  const daoAddress = requireAddress(network.name, "DAOManager")
  const dao = await ethers.getContractAt("DAOManager", daoAddress, signer)

  console.log(`DAOManager   : ${daoAddress}`)
  console.log(`Signer       : ${signer.address}`)
  console.log(`Proposal ID  : ${proposalId}`)
  console.log(`Voter        : ${shortAddr(voter)}`)
  console.log(`Support      : ${support} (${SUPPORT_LABELS[support]})`)
  console.log(`Weight       : ${weight}`)

  const alreadyVoted = await (dao as any).hasVoted(proposalId, voter)
  if (alreadyVoted) {
    console.log(`⚠️  ${shortAddr(voter)} has already voted on this proposal.`)
    return
  }

  const state = await (dao as any).proposalState(proposalId)
  console.log(`Proposal state: ${state}`)

  const tx = await (dao as any).castVote(proposalId, voter, support, weight)
  console.log(`\nTx hash  : ${tx.hash}`)
  await tx.wait()

  const proposal = await (dao as any).proposals(proposalId)
  console.log(`✅ Vote cast: ${SUPPORT_LABELS[support]} by ${shortAddr(voter)}`)
  console.log(`   For: ${proposal.forVotes} | Against: ${proposal.againstVotes} | Abstain: ${proposal.abstainVotes}`)
  hr()
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})

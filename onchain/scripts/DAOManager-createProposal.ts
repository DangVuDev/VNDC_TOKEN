/**
 * DAOManager-createProposal.ts
 * Create a proposal in a DAO (requires OPERATOR_ROLE).
 *
 * Env vars (required):
 *   DAO_ID        — bytes32 DAO ID (or use DAO_NAME to auto-hash)
 *   PROPOSER      — Address of the proposer
 *   TARGET        — Target contract address for the proposal action
 *   DESCRIPTION   — Proposal description text (hashed on-chain)
 *
 * Env vars (optional):
 *   DAO_NAME        — Human-readable DAO name to hash into DAO_ID
 *   PROPOSAL_NAME   — Human-readable proposal name to hash into PROPOSAL_ID
 *   PROPOSAL_ID     — Override auto-generated proposal ID
 *   CALL_VALUE      — ETH value to send with the call (default: 0)
 *   CALL_DATA       — Hex-encoded calldata for the target (default: 0x)
 *
 * Usage:
 *   DAO_NAME="vndc-dao-v1" PROPOSER=0x... TARGET=0x... DESCRIPTION="Increase mint limit" \
 *     npx hardhat run scripts/DAOManager-createProposal.ts --network localhost
 */
import { ethers, network } from "hardhat"
import { requireAddress, env, envOptional, shortAddr, hr } from "./_utils"

async function main() {
  hr("DAOManager — Create Proposal")

  const [signer] = await ethers.getSigners()

  const daoName = envOptional("DAO_NAME", "")
  const daoId = daoName
    ? ethers.keccak256(ethers.toUtf8Bytes(daoName))
    : env("DAO_ID")

  const proposalName = envOptional("PROPOSAL_NAME", "")
  const proposalId = proposalName
    ? ethers.keccak256(ethers.toUtf8Bytes(proposalName + Date.now()))
    : envOptional("PROPOSAL_ID", ethers.keccak256(ethers.toUtf8Bytes(`proposal-${Date.now()}`)))

  const proposer = env("PROPOSER")
  const target = env("TARGET")
  const description = env("DESCRIPTION")
  const descriptionHash = ethers.keccak256(ethers.toUtf8Bytes(description))
  const callValue = BigInt(envOptional("CALL_VALUE", "0"))
  const callData = envOptional("CALL_DATA", "0x")

  const daoAddress = requireAddress(network.name, "DAOManager")
  const dao = await ethers.getContractAt("DAOManager", daoAddress, signer)

  console.log(`DAOManager     : ${daoAddress}`)
  console.log(`Signer         : ${signer.address}`)
  console.log(`DAO ID         : ${daoId}`)
  console.log(`Proposal ID    : ${proposalId}`)
  console.log(`Proposer       : ${shortAddr(proposer)}`)
  console.log(`Target         : ${shortAddr(target)}`)
  console.log(`Description    : ${description}`)

  const tx = await (dao as any).createProposal(
    proposalId,
    daoId,
    proposer,
    target,
    callValue,
    callData,
    descriptionHash
  )
  console.log(`\nTx hash    : ${tx.hash}`)
  await tx.wait()

  console.log(`✅ Proposal created: ${proposalId}`)
  hr()
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})

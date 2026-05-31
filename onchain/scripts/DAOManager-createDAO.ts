/**
 * DAOManager-createDAO.ts
 * Create a new DAO on-chain (requires OPERATOR_ROLE).
 *
 * Env vars (required):
 *   DAO_NAME        — DAO name (hashed into DAO_ID)
 *   GOV_TOKEN       — Address of the governance token
 *   QUORUM_BPS      — Quorum in basis points (e.g. 1000 = 10%)
 *   VOTING_PERIOD   — Voting period in seconds
 *
 * Env vars (optional):
 *   DAO_ID          — Override auto-generated ID
 *   METADATA_URI    — IPFS URI for DAO metadata
 *   VOTING_DELAY    — Delay before voting starts in seconds (default: 0)
 *   TIMELOCK        — Timelock duration in seconds (default: 0)
 *
 * Usage:
 *   DAO_NAME="vndc-dao-v1" GOV_TOKEN=0xVNDC... QUORUM_BPS=1000 VOTING_PERIOD=604800 \
 *     npx hardhat run scripts/DAOManager-createDAO.ts --network localhost
 */
import { ethers, network } from "hardhat"
import { requireAddress, env, envOptional, formatDuration, hr } from "./_utils"

async function main() {
  hr("DAOManager — Create DAO")

  const [signer] = await ethers.getSigners()
  const daoName = envOptional("DAO_NAME", "")
  const daoId = daoName
    ? ethers.keccak256(ethers.toUtf8Bytes(daoName))
    : env("DAO_ID")

  const govToken = env("GOV_TOKEN")
  const quorumBps = Number(env("QUORUM_BPS"))
  const votingPeriod = Number(env("VOTING_PERIOD"))
  const metadataURI = envOptional("METADATA_URI", "")
  const votingDelay = Number(envOptional("VOTING_DELAY", "0"))
  const timelock = Number(envOptional("TIMELOCK", "0"))

  if (quorumBps <= 0 || quorumBps > 10000) {
    throw new Error(`QUORUM_BPS must be 1-10000. Got: ${quorumBps}`)
  }

  const daoAddress = requireAddress(network.name, "DAOManager")
  const dao = await ethers.getContractAt("DAOManager", daoAddress, signer)

  console.log(`DAOManager     : ${daoAddress}`)
  console.log(`Signer         : ${signer.address}`)
  console.log(`DAO ID         : ${daoId}`)
  if (daoName) console.log(`DAO Name       : ${daoName}`)
  console.log(`Gov Token      : ${govToken}`)
  console.log(`Quorum         : ${quorumBps} bps (${quorumBps / 100}%)`)
  console.log(`Voting period  : ${formatDuration(votingPeriod)}`)
  console.log(`Voting delay   : ${formatDuration(votingDelay)}`)
  console.log(`Timelock       : ${formatDuration(timelock)}`)

  const tx = await (dao as any).createDAO(
    daoId,
    daoName || "DAO",
    metadataURI,
    govToken,
    quorumBps,
    votingDelay,
    votingPeriod,
    timelock
  )
  console.log(`\nTx hash  : ${tx.hash}`)
  await tx.wait()

  console.log(`✅ DAO created: ${daoId}`)
  hr()
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})

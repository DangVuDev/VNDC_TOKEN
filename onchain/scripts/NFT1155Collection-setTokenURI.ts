/**
 * NFT1155Collection-setTokenURI.ts
 * Update the metadata URI for a specific token ID (owner-only).
 * Token must already exist (been minted).
 *
 * Env vars (required):
 *   TOKEN_ID   — NFT token ID to update
 *   TOKEN_URI  — New metadata URI (e.g. "ipfs://...")
 *
 * Usage:
 *   TOKEN_ID=1 TOKEN_URI=ipfs://newcid... \
 *     npx hardhat run scripts/NFT1155Collection-setTokenURI.ts --network localhost
 */
import { ethers, network } from "hardhat"
import { requireAddress, env, hr } from "./_utils"

async function main() {
  hr("NFT1155Collection — Set Token URI")

  const [signer] = await ethers.getSigners()
  const tokenId = Number(env("TOKEN_ID"))
  const tokenURI = env("TOKEN_URI")

  const nftAddress = requireAddress(network.name, "NFT1155Collection")
  const nft = await ethers.getContractAt("NFT1155Collection", nftAddress, signer)

  console.log(`Contract  : ${nftAddress}`)
  console.log(`Signer    : ${signer.address}`)
  console.log(`Token ID  : ${tokenId}`)
  console.log(`New URI   : ${tokenURI}`)

  const exists = await (nft as any).exists(tokenId)
  if (!exists) {
    throw new Error(`Token #${tokenId} does not exist. Mint it first.`)
  }

  const oldURI = await (nft as any).uri(tokenId)
  console.log(`Old URI   : ${oldURI}`)

  const tx = await (nft as any).setTokenURI(tokenId, tokenURI)
  console.log(`\nTx hash  : ${tx.hash}`)
  await tx.wait()

  console.log(`✅ URI updated for token #${tokenId}`)
  hr()
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})

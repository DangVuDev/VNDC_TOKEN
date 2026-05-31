/**
 * VNDCNFTCollection-mint.ts
 * Mint ERC-1155 NFT tokens (owner-only).
 *
 * Env vars (required):
 *   TO        — Recipient address
 *   TOKEN_ID  — NFT token ID (integer)
 *   AMOUNT    — Number of tokens to mint
 *
 * Env vars (optional):
 *   TOKEN_URI — Metadata URI for this token (e.g. "ipfs://...")
 *
 * Usage:
 *   TO=0x... TOKEN_ID=1 AMOUNT=10 TOKEN_URI=ipfs://Qm... \
 *     npx hardhat run scripts/VNDCNFTCollection-mint.ts --network localhost
 */
import { ethers, network } from "hardhat"
import { requireAddress, env, envOptional, shortAddr, hr } from "./_utils"

async function main() {
  hr("VNDCNFTCollection — Mint")

  const [signer] = await ethers.getSigners()
  const to = env("TO")
  const tokenId = Number(env("TOKEN_ID"))
  const amount = Number(env("AMOUNT"))
  const tokenURI = envOptional("TOKEN_URI", "")

  const nftAddress = requireAddress(network.name, "VNDCNFTCollection")
  const nft = await ethers.getContractAt("VNDCNFTCollection", nftAddress, signer)

  console.log(`Contract  : ${nftAddress}`)
  console.log(`Signer    : ${signer.address}`)
  console.log(`To        : ${to}`)
  console.log(`Token ID  : ${tokenId}`)
  console.log(`Amount    : ${amount}`)
  console.log(`URI       : ${tokenURI || "(none)"}`)

  const tx = await (nft as any).mint(to, tokenId, amount, tokenURI)
  console.log(`\nTx hash  : ${tx.hash}`)
  const receipt = await tx.wait()
  console.log(`Block    : ${receipt.blockNumber}`)

  const balance = await (nft as any).balanceOf(to, tokenId)
  const total = await (nft as any)["totalSupply(uint256)"](tokenId)
  console.log(`\n✅ Minted ${amount}× token #${tokenId} to ${shortAddr(to)}`)
  console.log(`   Balance of recipient : ${balance}`)
  console.log(`   Total supply #${tokenId} : ${total}`)
  hr()
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})

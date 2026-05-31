/**
 * MarketplaceManager-createListing.ts
 * Create an NFT listing on the marketplace (requires OPERATOR_ROLE).
 * NFT must be approved for transfer to MarketplaceManager before calling.
 *
 * Env vars (required):
 *   SELLER        — Seller address
 *   NFT_CONTRACT  — ERC-1155 NFT contract address
 *   TOKEN_ID      — NFT token ID
 *   AMOUNT        — Number of NFTs to list
 *   PRICE         — Price in VNDC per unit (e.g. "100")
 *   PAYMENT_TOKEN — Payment token address (use VNDCToken address)
 *
 * Env vars (optional):
 *   LISTING_NAME  — Human-readable name to hash into LISTING_ID
 *   LISTING_ID    — Override auto-generated ID
 *
 * Usage:
 *   SELLER=0x... NFT_CONTRACT=0x... TOKEN_ID=1 AMOUNT=5 PRICE=100 PAYMENT_TOKEN=0x... \
 *     npx hardhat run scripts/MarketplaceManager-createListing.ts --network localhost
 */
import { ethers, network } from "hardhat"
import { requireAddress, env, envOptional, parseVNDC, formatVNDC, shortAddr, hr } from "./_utils"

async function main() {
  hr("MarketplaceManager — Create Listing")

  const [signer] = await ethers.getSigners()

  const listingName = envOptional("LISTING_NAME", "")
  const listingId = listingName
    ? ethers.keccak256(ethers.toUtf8Bytes(listingName + Date.now()))
    : envOptional("LISTING_ID", ethers.keccak256(ethers.toUtf8Bytes(`listing-${Date.now()}`)))

  const seller = env("SELLER")
  const nftContract = env("NFT_CONTRACT")
  const tokenId = Number(env("TOKEN_ID"))
  const amount = Number(env("AMOUNT"))
  const price = parseVNDC(env("PRICE"))
  const paymentToken = env("PAYMENT_TOKEN")

  const mpAddress = requireAddress(network.name, "MarketplaceManager")
  const mp = await ethers.getContractAt("MarketplaceManager", mpAddress, signer)

  console.log(`Marketplace    : ${mpAddress}`)
  console.log(`Signer         : ${signer.address}`)
  console.log(`Listing ID     : ${listingId}`)
  console.log(`Seller         : ${shortAddr(seller)}`)
  console.log(`NFT contract   : ${nftContract}`)
  console.log(`Token ID       : ${tokenId}`)
  console.log(`Amount         : ${amount}`)
  console.log(`Price          : ${formatVNDC(price)} per unit`)
  console.log(`Total value    : ${formatVNDC(price * BigInt(amount))}`)
  console.log(`\nℹ️  Ensure ${shortAddr(seller)} has approved MarketplaceManager (${shortAddr(mpAddress)}) for NFT transfer.`)

  const tx = await (mp as any).createListing(
    listingId,
    seller,
    nftContract,
    paymentToken,
    tokenId,
    amount,
    price
  )
  console.log(`\nTx hash  : ${tx.hash}`)
  await tx.wait()

  console.log(`✅ Listing created: ${listingId}`)
  hr()
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})

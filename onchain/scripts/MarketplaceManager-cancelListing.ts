/**
 * MarketplaceManager-cancelListing.ts
 * Cancel an active NFT listing, returning the NFT to the seller (requires OPERATOR_ROLE).
 *
 * Env vars (required):
 *   LISTING_ID  — bytes32 listing ID to cancel
 *
 * Usage:
 *   LISTING_ID=0x... npx hardhat run scripts/MarketplaceManager-cancelListing.ts --network localhost
 */
import { ethers, network } from "hardhat"
import { requireAddress, env, formatVNDC, shortAddr, hr } from "./_utils"

async function main() {
  hr("MarketplaceManager — Cancel Listing")

  const [signer] = await ethers.getSigners()
  const listingId = env("LISTING_ID")

  const mpAddress = requireAddress(network.name, "MarketplaceManager")
  const mp = await ethers.getContractAt("MarketplaceManager", mpAddress, signer)

  console.log(`Marketplace  : ${mpAddress}`)
  console.log(`Signer       : ${signer.address}`)
  console.log(`Listing ID   : ${listingId}`)

  let listing: any
  try {
    listing = await (mp as any).listings(listingId)
    console.log(`Seller       : ${shortAddr(listing.seller)}`)
    console.log(`NFT          : ${listing.nftContract} #${listing.tokenId}`)
    console.log(`Amount       : ${listing.amount}`)
    console.log(`Price        : ${formatVNDC(listing.price)}`)
    console.log(`Status       : ${listing.status}`)
  } catch {
    console.log(`(Could not fetch listing details)`)
  }

  const tx = await (mp as any).cancelListing(listingId)
  console.log(`\nTx hash  : ${tx.hash}`)
  await tx.wait()

  console.log(`✅ Listing cancelled: ${listingId}`)
  if (listing?.seller) {
    console.log(`   NFT returned to seller: ${shortAddr(listing.seller)}`)
  }
  hr()
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})

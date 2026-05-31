/**
 * MarketplaceManager-finalizeSale.ts
 * Finalize a sale — transfers NFT to buyer and payment to seller (requires OPERATOR_ROLE).
 * The VNDC payment must have already been sent off-chain or via a separate tx.
 *
 * Env vars (required):
 *   LISTING_ID    — bytes32 listing ID
 *   PURCHASE_ID   — bytes32 purchase ID (unique per sale, hash of order reference)
 *   BUYER         — Address of the buyer
 *   PAYMENT_TX    — The tx hash confirming buyer's VNDC payment
 *
 * Env vars (optional):
 *   PURCHASE_REF  — Human-readable reference to hash into PURCHASE_ID (overrides PURCHASE_ID)
 *
 * Usage:
 *   LISTING_ID=0x... BUYER=0x... PAYMENT_TX=0x... PURCHASE_REF="order-20240101-001" \
 *     npx hardhat run scripts/MarketplaceManager-finalizeSale.ts --network localhost
 */
import { ethers, network } from "hardhat"
import { requireAddress, env, envOptional, formatVNDC, shortAddr, hr } from "./_utils"

async function main() {
  hr("MarketplaceManager — Finalize Sale")

  const [signer] = await ethers.getSigners()
  const listingId = env("LISTING_ID")
  const purchaseRef = envOptional("PURCHASE_REF", "")
  const purchaseId = purchaseRef
    ? ethers.keccak256(ethers.toUtf8Bytes(purchaseRef))
    : env("PURCHASE_ID")

  const buyer = env("BUYER")
  const paymentTxHash = env("PAYMENT_TX")

  const mpAddress = requireAddress(network.name, "MarketplaceManager")
  const mp = await ethers.getContractAt("MarketplaceManager", mpAddress, signer)

  console.log(`Marketplace  : ${mpAddress}`)
  console.log(`Signer       : ${signer.address}`)
  console.log(`Listing ID   : ${listingId}`)
  console.log(`Purchase ID  : ${purchaseId}`)
  if (purchaseRef) console.log(`Purchase ref : ${purchaseRef}`)
  console.log(`Buyer        : ${shortAddr(buyer)}`)
  console.log(`Payment Tx   : ${paymentTxHash}`)

  let listing: any
  try {
    listing = await (mp as any).listings(listingId)
    console.log(`\nListing info:`)
    console.log(`  Seller     : ${shortAddr(listing.seller)}`)
    console.log(`  NFT        : ${listing.nftContract} #${listing.tokenId}`)
    console.log(`  Amount     : ${listing.amount}`)
    console.log(`  Price      : ${formatVNDC(listing.price)} per unit`)
    console.log(`  Total      : ${formatVNDC(listing.price * BigInt(listing.amount))}`)
  } catch {
    console.log(`(Could not fetch listing details)`)
  }

  const tx = await (mp as any).finalizeSale(listingId, purchaseId, buyer, paymentTxHash)
  console.log(`\nTx hash  : ${tx.hash}`)
  await tx.wait()

  console.log(`✅ Sale finalized for listing: ${listingId}`)
  console.log(`   Buyer: ${shortAddr(buyer)} | Purchase: ${purchaseId}`)
  hr()
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})

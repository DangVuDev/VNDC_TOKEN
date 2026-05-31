/**
 * VNDCNFTCollection-info.ts
 * Display collection info and optionally check a specific token or wallet.
 *
 * Env vars (optional):
 *   TOKEN_ID      — Token ID to inspect
 *   CHECK_WALLET  — Wallet address to check balances for
 *   TOKEN_IDS     — Comma-separated list of token IDs to batch-check for CHECK_WALLET
 *
 * Usage:
 *   npx hardhat run scripts/VNDCNFTCollection-info.ts --network localhost
 *   TOKEN_ID=1 CHECK_WALLET=0x... TOKEN_IDS=1,2,3 npx hardhat run scripts/VNDCNFTCollection-info.ts --network localhost
 */
import { ethers, network } from "hardhat"
import { requireAddress, envOptional, hr } from "./_utils"

async function main() {
  hr("VNDCNFTCollection — Info")

  const nftAddress = requireAddress(network.name, "VNDCNFTCollection")
  const nft = await ethers.getContractAt("VNDCNFTCollection", nftAddress)

  const owner = await (nft as any).owner()
  console.log(`Contract  : ${nftAddress}`)
  console.log(`Network   : ${network.name}`)
  console.log(`Owner     : ${owner}`)

  // Check specific token
  const tokenIdEnv = envOptional("TOKEN_ID", "")
  if (tokenIdEnv) {
    const tokenId = Number(tokenIdEnv)
    const exists = await (nft as any).exists(tokenId)
    console.log(`\n── Token #${tokenId}`)
    console.log(`  Exists        : ${exists}`)
    if (exists) {
      const total = await (nft as any)["totalSupply(uint256)"](tokenId)
      const uri = await (nft as any).uri(tokenId)
      console.log(`  Total supply  : ${total}`)
      console.log(`  URI           : ${uri}`)
    }
  }

  // Check wallet balances
  const checkWallet = envOptional("CHECK_WALLET", "")
  if (checkWallet) {
    const tokenIdsStr = envOptional("TOKEN_IDS", tokenIdEnv || "")
    if (tokenIdsStr) {
      const ids = tokenIdsStr.split(",").map((s) => Number(s.trim()))
      const wallets = ids.map(() => checkWallet)
      const balances = await (nft as any).balanceOfBatch(wallets, ids)

      console.log(`\n── Wallet: ${checkWallet}`)
      for (let i = 0; i < ids.length; i++) {
        console.log(`  Token #${ids[i]}: balance = ${balances[i]}`)
      }
    }
  }

  hr()
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})

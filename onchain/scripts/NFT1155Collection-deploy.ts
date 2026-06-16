/**
 * NFT1155Collection-deploy.ts
 * Deploy the NFT1155Collection (ERC-1155) contract.
 *
 * Env vars:
 *   BASE_URI  — Base URI for metadata (default: "https://nft.vndc.io/metadata/")
 *
 * Usage:
 *   npx hardhat run scripts/NFT1155Collection-deploy.ts --network localhost
 *   BASE_URI=https://ipfs.io/ipfs/<cid>/ npx hardhat run scripts/NFT1155Collection-deploy.ts --network localhost
 */
import { ethers, network } from "hardhat"
import { saveAddress, envOptional, hr } from "./_utils"

async function main() {
  hr("NFT1155Collection — Deploy")

  const [deployer] = await ethers.getSigners()
  console.log(`Deployer : ${deployer.address}`)
  console.log(`Network  : ${network.name}`)

  const baseURI = envOptional("BASE_URI", "https://nft.vndc.io/metadata/")
  console.log(`Base URI : ${baseURI}`)

  const Factory = await ethers.getContractFactory("NFT1155Collection")
  const nft = await Factory.deploy(baseURI)
  await nft.waitForDeployment()

  const address = await nft.getAddress()
  console.log(`\n✅ NFT1155Collection deployed at: ${address}`)

  saveAddress(network.name, "NFT1155Collection", address, { deployer: deployer.address })
  hr()
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})

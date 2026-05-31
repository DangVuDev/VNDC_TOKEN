/**
 * NFTMarketplace721-deploy.ts
 * Deploy the NFTMarketplace721 contract.
 *
 * Usage:
 *   npx hardhat run scripts/NFTMarketplace721-deploy.ts --network localhost
 */
import { ethers, network } from "hardhat"
import { hr, saveAddress } from "./_utils"

async function main() {
  hr("NFTMarketplace721 — Deploy")

  const [deployer] = await ethers.getSigners()
  console.log(`Deployer : ${deployer.address}`)
  console.log(`Network  : ${network.name}`)

  const Factory = await ethers.getContractFactory("NFTMarketplace721")
  const market = await Factory.deploy()
  await market.waitForDeployment()

  const address = await market.getAddress()
  console.log(`\n✅ NFTMarketplace721 deployed at: ${address}`)
  console.log("ℹ️  Backend relayer must be contract owner for buyFor/updatePrice API sync")

  saveAddress(network.name, "NFTMarketplace721", address, { deployer: deployer.address })
  hr()
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})

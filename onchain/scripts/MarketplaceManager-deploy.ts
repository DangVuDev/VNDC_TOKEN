/**
 * MarketplaceManager-deploy.ts
 * Deploy the MarketplaceManager contract.
 *
 * Usage:
 *   npx hardhat run scripts/MarketplaceManager-deploy.ts --network localhost
 */
import { ethers, network } from "hardhat"
import { saveAddress, hr } from "./_utils"

async function main() {
  hr("MarketplaceManager — Deploy")

  const [deployer] = await ethers.getSigners()
  console.log(`Deployer : ${deployer.address}`)
  console.log(`Network  : ${network.name}`)

  const Factory = await ethers.getContractFactory("MarketplaceManager")
  const mp = await Factory.deploy()
  await mp.waitForDeployment()

  const address = await mp.getAddress()
  console.log(`\n✅ MarketplaceManager deployed at: ${address}`)
  console.log(`ℹ️  Deployer has OPERATOR_ROLE. Grant it to backend wallet with MarketplaceManager-grantOperatorRole.ts`)

  saveAddress(network.name, "MarketplaceManager", address, { deployer: deployer.address })
  hr()
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})

/**
 * DAOManager-deploy.ts
 * Deploy the DAOManager contract.
 *
 * Usage:
 *   npx hardhat run scripts/DAOManager-deploy.ts --network localhost
 */
import { ethers, network } from "hardhat"
import { saveAddress, hr } from "./_utils"

async function main() {
  hr("DAOManager — Deploy")

  const [deployer] = await ethers.getSigners()
  console.log(`Deployer : ${deployer.address}`)
  console.log(`Network  : ${network.name}`)

  const Factory = await ethers.getContractFactory("DAOManager")
  const dao = await Factory.deploy()
  await dao.waitForDeployment()

  const address = await dao.getAddress()
  console.log(`\n✅ DAOManager deployed at: ${address}`)
  console.log(`ℹ️  Deployer has OPERATOR_ROLE. Grant it to backend wallet with DAOManager-grantOperatorRole.ts`)

  saveAddress(network.name, "DAOManager", address, { deployer: deployer.address })
  hr()
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})

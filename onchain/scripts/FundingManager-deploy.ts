/**
 * FundingManager-deploy.ts
 * Deploy the FundingManager contract.
 *
 * Env vars:
 *   VNDC_TOKEN  — Address of the deployed VNDCToken (optional, reads from deployed-addresses.json)
 *
 * Usage:
 *   npx hardhat run scripts/FundingManager-deploy.ts --network localhost
 */
import { ethers, network } from "hardhat"
import { saveAddress, requireAddress, envOptional, hr } from "./_utils"

async function main() {
  hr("FundingManager — Deploy")

  const [deployer] = await ethers.getSigners()
  console.log(`Deployer : ${deployer.address}`)
  console.log(`Network  : ${network.name}`)

  const vndcAddress = envOptional("VNDC_TOKEN", requireAddress(network.name, "VNDCToken"))
  console.log(`VNDCToken: ${vndcAddress}`)

  const Factory = await ethers.getContractFactory("FundingManager")
  const fm = await Factory.deploy(vndcAddress)
  await fm.waitForDeployment()

  const address = await fm.getAddress()
  console.log(`\n✅ FundingManager deployed at: ${address}`)

  saveAddress(network.name, "FundingManager", address, { deployer: deployer.address })
  hr()
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})

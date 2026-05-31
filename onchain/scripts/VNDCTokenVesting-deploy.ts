/**
 * VNDCTokenVesting-deploy.ts
 * Deploy the VNDCTokenVesting contract.
 *
 * Env vars:
 *   VNDC_TOKEN  — Address of the deployed VNDCToken (optional, reads from deployed-addresses.json)
 *
 * Usage:
 *   npx hardhat run scripts/VNDCTokenVesting-deploy.ts --network localhost
 */
import { ethers, network } from "hardhat"
import { saveAddress, requireAddress, envOptional, hr } from "./_utils"

async function main() {
  hr("VNDCTokenVesting — Deploy")

  const [deployer] = await ethers.getSigners()
  console.log(`Deployer : ${deployer.address}`)
  console.log(`Network  : ${network.name}`)

  const vndcAddress = envOptional("VNDC_TOKEN", requireAddress(network.name, "VNDCToken"))
  console.log(`VNDCToken: ${vndcAddress}`)

  const Factory = await ethers.getContractFactory("VNDCTokenVesting")
  const vesting = await Factory.deploy(vndcAddress)
  await vesting.waitForDeployment()

  const address = await vesting.getAddress()
  console.log(`\n✅ VNDCTokenVesting deployed at: ${address}`)

  saveAddress(network.name, "VNDCTokenVesting", address, { deployer: deployer.address })
  hr()
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})

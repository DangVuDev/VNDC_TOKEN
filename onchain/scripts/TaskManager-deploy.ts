/**
 * TaskManager-deploy.ts
 * Deploy the TaskManager contract.
 *
 * Env vars:
 *   VNDC_TOKEN  — Address of the deployed VNDCToken (optional, reads from deployed-addresses.json)
 *
 * Usage:
 *   npx hardhat run scripts/TaskManager-deploy.ts --network localhost
 */
import { ethers, network } from "hardhat"
import { saveAddress, requireAddress, envOptional, hr } from "./_utils"

async function main() {
  hr("TaskManager — Deploy")

  const [deployer] = await ethers.getSigners()
  console.log(`Deployer : ${deployer.address}`)
  console.log(`Network  : ${network.name}`)

  const vndcAddress = envOptional("VNDC_TOKEN", requireAddress(network.name, "VNDCToken"))
  console.log(`VNDCToken: ${vndcAddress}`)

  const Factory = await ethers.getContractFactory("TaskManager")
  const tm = await Factory.deploy(vndcAddress)
  await tm.waitForDeployment()

  const address = await tm.getAddress()
  console.log(`\n✅ TaskManager deployed at: ${address}`)

  saveAddress(network.name, "TaskManager", address, { deployer: deployer.address })
  hr()
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})

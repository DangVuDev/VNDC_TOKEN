/**
 * VNDCStaking-deploy.ts
 * Deploy the VNDCStaking contract.
 *
 * Env vars:
 *   VNDC_TOKEN  — Address of the deployed VNDCToken (optional, reads from deployed-addresses.json)
 *
 * Usage:
 *   npx hardhat run scripts/VNDCStaking-deploy.ts --network localhost
 */
import { ethers, network } from "hardhat"
import { saveAddress, requireAddress, envOptional, hr } from "./_utils"

async function main() {
  hr("VNDCStaking — Deploy")

  const [deployer] = await ethers.getSigners()
  console.log(`Deployer : ${deployer.address}`)
  console.log(`Network  : ${network.name}`)

  const vndcAddress = envOptional("VNDC_TOKEN", requireAddress(network.name, "VNDCToken"))
  console.log(`VNDCToken: ${vndcAddress}`)

  const Factory = await ethers.getContractFactory("VNDCStaking")
  const staking = await Factory.deploy(vndcAddress)
  await staking.waitForDeployment()

  const address = await staking.getAddress()
  console.log(`\n✅ VNDCStaking deployed at: ${address}`)

  saveAddress(network.name, "VNDCStaking", address, { deployer: deployer.address })

  const rewardRate = await (staking as any).rewardRate()
  const minStake = await (staking as any).minStakeAmount()
  console.log(`\nReward rate : ${rewardRate} bps (${Number(rewardRate) / 100}% APY)`)
  console.log(`Min stake   : ${minStake} wei`)
  hr()
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})

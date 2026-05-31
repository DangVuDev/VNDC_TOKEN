/**
 * VNDCToken-deploy.ts
 * Deploy the VNDCToken ERC-20 contract.
 *
 * Env vars:
 *   INITIAL_SUPPLY  — Initial mint amount in VNDC (default: 100_000_000)
 *
 * Usage:
 *   npx hardhat run scripts/VNDCToken-deploy.ts --network localhost
 */
import { ethers, network } from "hardhat"
import { saveAddress, parseVNDC, formatVNDC, envOptional, hr } from "./_utils"

async function main() {
  hr("VNDCToken — Deploy")

  const [deployer] = await ethers.getSigners()
  console.log(`Deployer  : ${deployer.address}`)
  console.log(`Network   : ${network.name}`)

  const initialSupplyVNDC = envOptional("INITIAL_SUPPLY", "100000000")
  const initialSupply = parseVNDC(initialSupplyVNDC)
  console.log(`Initial supply: ${formatVNDC(initialSupply)}`)

  const Factory = await ethers.getContractFactory("VNDCToken")
  const token = await Factory.deploy(initialSupply)
  await token.waitForDeployment()

  const address = await token.getAddress()
  console.log(`\n✅ VNDCToken deployed at: ${address}`)

  saveAddress(network.name, "VNDCToken", address, {
    chainId: String(network.config.chainId ?? "unknown"),
    deployer: deployer.address,
  })

  // Verify initial state
  const name = await token.name()
  const symbol = await token.symbol()
  const totalSupply = await token.totalSupply()
  console.log(`\nToken: ${name} (${symbol})`)
  console.log(`Total supply: ${formatVNDC(totalSupply)}`)
  hr()
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})

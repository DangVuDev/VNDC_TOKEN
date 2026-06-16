/**
 * VNDCErc721Collection-deploy.ts
 * Deploy the VNDCErc721Collection contract.
 *
 * Usage:
 *   npx hardhat run scripts/VNDCErc721Collection-deploy.ts --network localhost
 */
import { ethers, network } from "hardhat"
import { hr, saveAddress } from "./_utils"

async function main() {
  hr("VNDCErc721Collection — Deploy")

  const [deployer] = await ethers.getSigners()
  console.log(`Deployer : ${deployer.address}`)
  console.log(`Network  : ${network.name}`)

  const Factory = await ethers.getContractFactory("NFT721Collection")
  const collection = await Factory.deploy("VNDC NFT Shop", "VNDCNFT")
  await collection.waitForDeployment()

  const address = await collection.getAddress()
  console.log(`\n✅ NFT721Collection deployed at: ${address}`)
  console.log("ℹ️  Backend relayer must be contract owner to mint via API")

  saveAddress(network.name, "NFT721Collection", address, { deployer: deployer.address })
  hr()
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})

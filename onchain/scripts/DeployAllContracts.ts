/**
 * DeployAllContracts.ts
 * Deploy every VNDC contract in dependency order and print all addresses.
 *
 * Env vars:
 *   INITIAL_SUPPLY  - Initial VNDCToken supply in VNDC (default: 100000000)
 *   BASE_URI        - ERC-1155 metadata base URI (default: https://nft.vndc.io/metadata/)
 *
 * Usage:
 *   npx hardhat run scripts/DeployAllContracts.ts --network localhost
 */
import { ethers, network } from "hardhat"
import { envOptional, formatVNDC, hr, parseVNDC, saveAddress } from "./_utils"

type Deployment = {
  name: string
  address: string
}

async function deployContract(
  name: string,
  args: unknown[] = [],
  extra: Record<string, string> = {}
): Promise<string> {
  console.log(`\nDeploying ${name}...`)

  const Factory = await ethers.getContractFactory(name)
  const contract = await Factory.deploy(...args)
  await contract.waitForDeployment()

  const address = await contract.getAddress()
  saveAddress(network.name, name, address, extra)
  console.log(`${name} deployed at: ${address}`)

  return address
}

function printDeployments(deployments: Deployment[]) {
  hr("Deployment addresses")

  const nameWidth = Math.max(...deployments.map((item) => item.name.length), "Contract".length)
  console.log(`${"Contract".padEnd(nameWidth)}  Address`)
  console.log(`${"-".repeat(nameWidth)}  ${"-".repeat(42)}`)

  for (const item of deployments) {
    console.log(`${item.name.padEnd(nameWidth)}  ${item.address}`)
  }

  hr()
}

async function main() {
  hr("Deploy all VNDC contracts")

  const [deployer] = await ethers.getSigners()
  const chainId = String(network.config.chainId ?? "unknown")
  const commonExtra = { chainId, deployer: deployer.address }
  const deployments: Deployment[] = []

  console.log(`Deployer : ${deployer.address}`)
  console.log(`Network  : ${network.name}`)
  console.log(`Chain ID : ${chainId}`)

  const initialSupplyVNDC = envOptional("INITIAL_SUPPLY", "100000000")
  const initialSupply = parseVNDC(initialSupplyVNDC)
  console.log(`Initial VNDCToken supply: ${formatVNDC(initialSupply)}`)

  const vndcToken = await deployContract("VNDCToken", [initialSupply], commonExtra)
  deployments.push({ name: "VNDCToken", address: vndcToken })

  const token = await ethers.getContractAt("VNDCToken", vndcToken)
  console.log(`Token name   : ${await token.name()}`)
  console.log(`Token symbol : ${await token.symbol()}`)
  console.log(`Total supply : ${formatVNDC(await token.totalSupply())}`)

  const tokenLinkedContracts: Array<[string, unknown[]]> = [
    ["VNDCTokenVesting", [vndcToken]],
    ["VNDCStaking", [vndcToken]],
    ["TaskManager", [vndcToken]],
    ["FundingManager", [vndcToken]],
  ]

  for (const [name, args] of tokenLinkedContracts) {
    const address = await deployContract(name, args, commonExtra)
    deployments.push({ name, address })
  }

  const standaloneContracts: Array<[string, unknown[]]> = [
    ["DAOManager", []],
    ["MarketplaceManager", []],
  ]

  for (const [name, args] of standaloneContracts) {
    const address = await deployContract(name, args, commonExtra)
    deployments.push({ name, address })
  }

  const baseURI = envOptional("BASE_URI", "https://nft.vndc.io/metadata/")
  console.log(`\nERC-1155 base URI: ${baseURI}`)
  const erc1155 = await deployContract("NFT1155Collection", [baseURI], commonExtra)
  deployments.push({ name: "NFT1155Collection", address: erc1155 })

  const erc721 = await deployContract("NFT721Collection", ["VNDC NFT Shop", "VNDCNFT"], commonExtra)
  deployments.push({ name: "NFT721Collection", address: erc721 })

  const erc721Marketplace = await deployContract("NFTMarketplace721", [], commonExtra)
  deployments.push({ name: "NFTMarketplace721", address: erc721Marketplace })

  printDeployments(deployments)
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})

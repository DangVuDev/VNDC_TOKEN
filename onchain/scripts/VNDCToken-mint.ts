/**
 * VNDCToken-mint.ts
 * Mint VNDC tokens to a recipient address.
 *
 * Env vars (required):
 *   TO      — Recipient address
 *   AMOUNT  — Amount in VNDC (e.g. "1000" or "500.5")
 *
 * Usage:
 *   TO=0xRecipient AMOUNT=1000 npx hardhat run scripts/VNDCToken-mint.ts --network localhost
 */
import { ethers, network } from "hardhat"
import { requireAddress, env, parseVNDC, formatVNDC, shortAddr, hr } from "./_utils"

async function main() {
  hr("VNDCToken — Mint")

  const [signer] = await ethers.getSigners()
  const to = env("TO")
  const amount = parseVNDC(env("AMOUNT"))

  const tokenAddress = requireAddress(network.name, "VNDCToken")
  const token = await ethers.getContractAt("VNDCToken", tokenAddress, signer)

  console.log(`Contract : ${tokenAddress}`)
  console.log(`Signer   : ${signer.address}`)
  console.log(`To       : ${to}`)
  console.log(`Amount   : ${formatVNDC(amount)}`)

  const balanceBefore = await (token as any).balanceOf(to)

  const tx = await (token as any).mint(to, amount)
  console.log(`\nTx hash  : ${tx.hash}`)
  const receipt = await tx.wait()
  console.log(`Block    : ${receipt.blockNumber}`)

  const balanceAfter = await (token as any).balanceOf(to)
  console.log(`\n✅ Minted ${formatVNDC(amount)} to ${shortAddr(to)}`)
  console.log(`   Balance: ${formatVNDC(balanceBefore)} → ${formatVNDC(balanceAfter)}`)
  hr()
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})

/**
 * VNDCToken-transferWithSignature.ts
 * Execute an EIP-712 signed meta-transfer on VNDCToken.
 * The deployer/signer generates and submits the signed transfer on behalf of FROM.
 *
 * Env vars (required):
 *   FROM      — Address whose tokens to transfer (must be the signer)
 *   TO        — Recipient address
 *   AMOUNT    — Amount in VNDC (e.g. "100")
 *   DEADLINE  — Unix timestamp deadline (default: 10 minutes from now)
 *
 * Usage:
 *   FROM=0x... TO=0x... AMOUNT=100 npx hardhat run scripts/VNDCToken-transferWithSignature.ts --network localhost
 */
import { ethers, network } from "hardhat"
import { requireAddress, env, envOptional, parseVNDC, formatVNDC, shortAddr, hr } from "./_utils"

async function main() {
  hr("VNDCToken — Transfer With Signature (EIP-712)")

  const signers = await ethers.getSigners()
  const from = env("FROM")
  const to = env("TO")
  const amount = parseVNDC(env("AMOUNT"))
  const deadline = Number(envOptional("DEADLINE", String(Math.floor(Date.now() / 1000) + 600)))

  // Find signer matching FROM
  const signer = signers.find((s) => s.address.toLowerCase() === from.toLowerCase())
  if (!signer) {
    throw new Error(
      `No signer found for FROM=${from}.\n` +
        `Available signers: ${signers.map((s) => s.address).join(", ")}`
    )
  }

  const tokenAddress = requireAddress(network.name, "VNDCToken")
  const token = await ethers.getContractAt("VNDCToken", tokenAddress, signer)

  console.log(`Contract : ${tokenAddress}`)
  console.log(`From     : ${from}`)
  console.log(`To       : ${to}`)
  console.log(`Amount   : ${formatVNDC(amount)}`)
  console.log(`Deadline : ${new Date(deadline * 1000).toISOString()}`)

  // Get current nonce
  const nonce = await (token as any).nonces(from)
  console.log(`Nonce    : ${nonce}`)

  // Build EIP-712 domain
  const chainId = (await ethers.provider.getNetwork()).chainId
  const domain = {
    name: "VNDC Token",
    version: "1",
    chainId: Number(chainId),
    verifyingContract: tokenAddress,
  }

  const types = {
    Transfer: [
      { name: "from", type: "address" },
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "nonce", type: "uint256" },
      { name: "deadline", type: "uint256" },
    ],
  }

  const value = { from, to, amount, nonce, deadline }
  const signature = await signer.signTypedData(domain, types, value)

  console.log(`\nSignature: ${signature}`)

  // Submit transaction (can be submitted by any relayer)
  const [relayer] = await ethers.getSigners()
  const tokenAsRelayer = await ethers.getContractAt("VNDCToken", tokenAddress, relayer)
  const tx = await (tokenAsRelayer as any).transferWithSignature(from, to, amount, nonce, deadline, signature)
  console.log(`Tx hash  : ${tx.hash}`)
  const receipt = await tx.wait()
  console.log(`Block    : ${receipt.blockNumber}`)

  console.log(`\n✅ Signed transfer: ${formatVNDC(amount)} from ${shortAddr(from)} → ${shortAddr(to)}`)
  hr()
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})

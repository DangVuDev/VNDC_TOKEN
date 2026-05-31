/**
 * VNDCToken-info.ts
 * Read and display all VNDCToken state.
 *
 * Env vars (optional):
 *   CHECK_WALLET  — Address to check balance and roles for
 *
 * Usage:
 *   npx hardhat run scripts/VNDCToken-info.ts --network localhost
 *   CHECK_WALLET=0x... npx hardhat run scripts/VNDCToken-info.ts --network localhost
 */
import { ethers, network } from "hardhat"
import { requireAddress, envOptional, formatVNDC, hr } from "./_utils"

async function main() {
  hr("VNDCToken — Info")

  const tokenAddress = requireAddress(network.name, "VNDCToken")
  const token = await ethers.getContractAt("VNDCToken", tokenAddress)

  const [name, symbol, decimals, totalSupply, maxSupply, paused] = await Promise.all([
    (token as any).name(),
    (token as any).symbol(),
    (token as any).decimals(),
    (token as any).totalSupply(),
    (token as any).MAX_SUPPLY(),
    (token as any).paused(),
  ])

  console.log(`Contract     : ${tokenAddress}`)
  console.log(`Network      : ${network.name}`)
  console.log(`Name         : ${name}`)
  console.log(`Symbol       : ${symbol}`)
  console.log(`Decimals     : ${decimals}`)
  console.log(`Total Supply : ${formatVNDC(totalSupply)}`)
  console.log(`Max Supply   : ${formatVNDC(maxSupply)}`)
  console.log(`Supply Used  : ${((Number(totalSupply) / Number(maxSupply)) * 100).toFixed(4)}%`)
  console.log(`Paused       : ${paused}`)

  const MINTER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("MINTER_ROLE"))
  const PAUSER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("PAUSER_ROLE"))
  console.log(`\nMINTER_ROLE  : ${MINTER_ROLE}`)
  console.log(`PAUSER_ROLE  : ${PAUSER_ROLE}`)

  const checkWallet = envOptional("CHECK_WALLET", "")
  if (checkWallet) {
    const [balance, isAdmin, isMinter, isPauser, vestingInfo] = await Promise.all([
      (token as any).balanceOf(checkWallet),
      (token as any).hasRole("0x0000000000000000000000000000000000000000000000000000000000000000", checkWallet),
      (token as any).hasRole(MINTER_ROLE, checkWallet),
      (token as any).hasRole(PAUSER_ROLE, checkWallet),
      (token as any).vestingInfo(checkWallet),
    ])
    console.log(`\n── Wallet: ${checkWallet}`)
    console.log(`Balance          : ${formatVNDC(balance)}`)
    console.log(`DEFAULT_ADMIN    : ${isAdmin}`)
    console.log(`MINTER_ROLE      : ${isMinter}`)
    console.log(`PAUSER_ROLE      : ${isPauser}`)
    if (vestingInfo.amount > 0n) {
      console.log(`Vesting amount   : ${formatVNDC(vestingInfo.amount)}`)
      console.log(`Vesting unlocks  : ${new Date(Number(vestingInfo.releaseTime) * 1000).toISOString()}`)
    } else {
      console.log(`Vesting          : none`)
    }
  }

  hr()
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})

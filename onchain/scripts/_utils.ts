/**
 * Shared utilities for all Hardhat scripts.
 * Provides address loading/saving, VNDC formatting helpers, and env var reader.
 */
import * as fs from "fs"
import * as path from "path"

const ADDRESSES_FILE = path.join(__dirname, "..", "deployed-addresses.json")

// ── Address management ────────────────────────────────────────────────────────

export function loadAddresses(network: string): Record<string, string> {
  if (!fs.existsSync(ADDRESSES_FILE)) return {}
  const all = JSON.parse(fs.readFileSync(ADDRESSES_FILE, "utf8"))
  return all[network] ?? {}
}

export function saveAddress(
  network: string,
  contractName: string,
  address: string,
  extra: Record<string, string> = {}
) {
  const all = fs.existsSync(ADDRESSES_FILE)
    ? JSON.parse(fs.readFileSync(ADDRESSES_FILE, "utf8"))
    : {}

  if (!all[network]) all[network] = {}
  all[network][contractName] = address
  all[network]["deployedAt"] = new Date().toISOString()
  for (const [k, v] of Object.entries(extra)) all[network][k] = v

  fs.writeFileSync(ADDRESSES_FILE, JSON.stringify(all, null, 2))
  console.log(`💾 Saved ${contractName} = ${address} (network: ${network})`)
}

export function requireAddress(network: string, contractName: string): string {
  const addr = loadAddresses(network)[contractName]
  if (!addr) {
    throw new Error(
      `Address for ${contractName} not found on network "${network}".\n` +
        `Run the deploy script first: npx hardhat run scripts/${contractName}-deploy.ts --network ${network}`
    )
  }
  return addr
}

// ── Environment helpers ───────────────────────────────────────────────────────

export function env(name: string, defaultVal?: string): string {
  const v = process.env[name] ?? defaultVal
  if (v === undefined)
    throw new Error(
      `Missing required env var: ${name}\nUsage: ${name}=<value> npx hardhat run <script> --network <network>`
    )
  return v
}

export function envOptional(name: string, defaultVal: string): string {
  return process.env[name] ?? defaultVal
}

// ── VNDC token math ───────────────────────────────────────────────────────────

export const VNDC_DECIMALS = 18n
export const ONE_VNDC = 10n ** VNDC_DECIMALS

/**
 * Parse a human-readable VNDC amount (e.g. "1000.5") to wei (bigint).
 */
export function parseVNDC(amount: string): bigint {
  const [intPart, decPart = ""] = amount.split(".")
  const padded = (decPart + "0".repeat(18)).slice(0, 18)
  return BigInt(intPart) * ONE_VNDC + BigInt(padded || "0")
}

/**
 * Format a wei amount as a human-readable VNDC string.
 */
export function formatVNDC(wei: bigint): string {
  const int = wei / ONE_VNDC
  const dec = wei % ONE_VNDC
  if (dec === 0n) return `${int.toLocaleString()} VNDC`
  const decStr = dec.toString().padStart(18, "0").replace(/0+$/, "")
  return `${int.toLocaleString()}.${decStr} VNDC`
}

/**
 * Short address display (0x1234...5678).
 */
export function shortAddr(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

/**
 * Convert seconds to a human readable duration.
 */
export function formatDuration(seconds: number): string {
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const parts: string[] = []
  if (d > 0) parts.push(`${d}d`)
  if (h > 0) parts.push(`${h}h`)
  if (m > 0) parts.push(`${m}m`)
  if (parts.length === 0) parts.push(`${seconds}s`)
  return parts.join(" ")
}

/**
 * Print separator.
 */
export function hr(label?: string) {
  const line = "─".repeat(60)
  console.log(label ? `\n${line}\n  ${label}\n${line}` : line)
}

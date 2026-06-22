export const ethers: {
  ZeroHash: string
  id(value: string): string
  formatUnits(value: bigint | string | number, decimals?: number): string
}

export class JsonRpcProvider {
  constructor(url?: string)
  getNetwork(): Promise<{ chainId: bigint | number; name: string }>
  getBlockNumber(): Promise<number>
  getBalance(address: string): Promise<bigint>
}

export class BrowserProvider {
  constructor(provider?: unknown)
  getSigner(): Promise<{
    getAddress(): Promise<string>
  }>
}

export class Contract {
  constructor(address: string, abi: readonly string[], runner?: unknown)
  [method: string]: any
}

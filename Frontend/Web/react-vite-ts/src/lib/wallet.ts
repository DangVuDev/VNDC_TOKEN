export type EthereumProvider = {
  request<T = unknown>(args: { method: string; params?: unknown[] | Record<string, unknown> }): Promise<T>
}

declare global {
  interface Window {
    ethereum?: EthereumProvider
  }
}

type TransferTypedDataInput = {
  chainId: number
  verifyingContract: string
  from: string
  to: string
  amount: string
  nonce: string
  deadline: string | number
}

function getProvider(provider?: EthereumProvider) {
  const nextProvider = provider ?? (window.ethereum as EthereumProvider | undefined)
  if (!nextProvider) {
    throw new Error('No injected wallet provider found.')
  }
  return nextProvider
}

export async function connectWallet(provider?: EthereumProvider) {
  const ethereum = getProvider(provider)
  return ethereum.request<string[]>({ method: 'eth_requestAccounts' })
}

export async function getEthereumChainId(provider?: EthereumProvider) {
  const ethereum = getProvider(provider)
  const value = await ethereum.request<string>({ method: 'eth_chainId' })
  return Number.parseInt(value, 16)
}

/**
 * Switch MetaMask to the specified chain, or add it if it doesn't exist.
 * @param chainId - Target chain ID (e.g., 31337 for local, 11155111 for Sepolia)
 * @param provider - Optional provider (defaults to window.ethereum)
 */
export async function switchChain(chainId: number, provider?: EthereumProvider) {
  const ethereum = getProvider(provider)
  const hexChainId = `0x${chainId.toString(16)}`
  
  try {
    // Try to switch to the chain if it already exists in MetaMask
    await ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: hexChainId }] })
  } catch (error: unknown) {
    const err = error as { code?: number; message?: string }
    
    // Error 4902 means chain doesn't exist, try to add it
    if (err?.code === 4902 || err?.message?.includes('Unrecognized chain ID')) {
      const chainConfig = getChainConfig(chainId)
      if (!chainConfig) {
        throw new Error(`Unsupported chain ID: ${chainId}`)
      }
      
      try {
        await ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [chainConfig],
        })
      } catch (addError) {
        console.error('Failed to add chain:', addError)
        throw addError
      }
    } else {
      // Re-throw other errors
      throw error
    }
  }
}

/**
 * Get MetaMask network configuration for a chain ID.
 */
function getChainConfig(chainId: number): Record<string, unknown> | null {
  const configs: Record<number, Record<string, unknown>> = {
    31337: {
      chainId: '0x7a69',
      chainName: 'Hardhat Local Node',
      nativeCurrency: {
        name: 'Ether',
        symbol: 'ETH',
        decimals: 18,
      },
      rpcUrls: ['http://127.0.0.1:8545'],
      blockExplorerUrls: [],
    },
    11155111: {
      chainId: '0xaa36a7',
      chainName: 'Sepolia Testnet',
      nativeCurrency: {
        name: 'Sepolia ETH',
        symbol: 'ETH',
        decimals: 18,
      },
      rpcUrls: ['https://ethereum-sepolia-rpc.publicnode.com'],
      blockExplorerUrls: ['https://sepolia.etherscan.io'],
    },
  }
  
  return configs[chainId] || null
}

export async function signPersonalMessage(provider: EthereumProvider | undefined, address: string, message: string) {
  const ethereum = getProvider(provider)
  try {
    return await ethereum.request<string>({ method: 'personal_sign', params: [message, address] })
  } catch {
    return ethereum.request<string>({ method: 'personal_sign', params: [address, message] })
  }
}

export async function signTypedData(provider: EthereumProvider | undefined, address: string, typedData: Record<string, unknown>) {
  const ethereum = getProvider(provider)
  return ethereum.request<string>({ method: 'eth_signTypedData_v4', params: [address, JSON.stringify(typedData)] })
}

export function buildTransferTypedData(input: TransferTypedDataInput) {
  return {
    domain: {
      name: 'VNDC Token',
      version: '1',
      chainId: input.chainId,
      verifyingContract: input.verifyingContract,
    },
    primaryType: 'Transfer',
    types: {
      EIP712Domain: [
        { name: 'name', type: 'string' },
        { name: 'version', type: 'string' },
        { name: 'chainId', type: 'uint256' },
        { name: 'verifyingContract', type: 'address' },
      ],
      Transfer: [
        { name: 'from', type: 'address' },
        { name: 'to', type: 'address' },
        { name: 'amount', type: 'uint256' },
        { name: 'nonce', type: 'uint256' },
        { name: 'deadline', type: 'uint256' },
      ],
    },
    message: {
      from: input.from,
      to: input.to,
      amount: input.amount,
      nonce: input.nonce,
      deadline: input.deadline,
    },
  }
}
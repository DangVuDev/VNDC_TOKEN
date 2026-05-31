import { useEffect, useRef } from 'react'

/**
 * Listens for MetaMask account and chain changes.
 * Calls onWalletChanged when account is switched to a different address.
 * Reloads the page when chain is changed.
 */
export function useWalletEvents(
  currentAddress: string | null | undefined,
  onWalletChanged: () => void,
) {
  const onChangedRef = useRef(onWalletChanged)
  onChangedRef.current = onWalletChanged

  useEffect(() => {
    const eth = (window as Window & typeof globalThis & { ethereum?: EthereumProvider }).ethereum
    if (!eth || typeof eth.on !== 'function') return

    const handleAccountsChanged = (accounts: unknown) => {
      const newAddr = Array.isArray(accounts) ? (accounts[0] as string | undefined) : undefined
      if (!newAddr) {
        // Wallet disconnected
        onChangedRef.current()
        return
      }
      if (currentAddress && newAddr.toLowerCase() !== currentAddress.toLowerCase()) {
        // Switched to a different account — force logout
        onChangedRef.current()
      }
    }

    const handleChainChanged = () => {
      // Chain change always requires a full reload per MetaMask best practices
      window.location.reload()
    }

    eth.on('accountsChanged', handleAccountsChanged)
    eth.on('chainChanged', handleChainChanged)

    return () => {
      eth.removeListener?.('accountsChanged', handleAccountsChanged)
      eth.removeListener?.('chainChanged', handleChainChanged)
    }
  }, [currentAddress])
}

// Minimal type for window.ethereum
interface EthereumProvider {
  on(event: string, handler: (payload: unknown) => void): void
  removeListener?(event: string, handler: (payload: unknown) => void): void
}

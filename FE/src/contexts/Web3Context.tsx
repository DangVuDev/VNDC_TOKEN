import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { BrowserProvider, JsonRpcSigner, formatEther } from 'ethers';
import toast from 'react-hot-toast';

interface Web3State {
  provider: BrowserProvider | null;
  signer: JsonRpcSigner | null;
  address: string | null;
  chainId: number | null;
  balance: string;
  isConnecting: boolean;
  isConnected: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
  switchNetwork: (chainId: number) => Promise<void>;
}

const Web3Context = createContext<Web3State>({} as Web3State);

export const useWeb3 = () => useContext(Web3Context);

const SUPPORTED_CHAINS: Record<number, string> = {
  1: 'Ethereum Mainnet',
  11155111: 'Sepolia Testnet',
  137: 'Polygon Mainnet',
  80001: 'Mumbai Testnet',
  31337: 'Hardhat Local',
};

export function Web3Provider({ children }: { children: ReactNode }) {
  const [provider, setProvider] = useState<BrowserProvider | null>(null);
  const [signer, setSigner] = useState<JsonRpcSigner | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [balance, setBalance] = useState('0');
  const [isConnecting, setIsConnecting] = useState(false);

  const updateBalance = useCallback(async (provider: BrowserProvider, address: string) => {
    try {
      const bal = await provider.getBalance(address);
      setBalance(formatEther(bal));
    } catch {
      setBalance('0');
    }
  }, []);

  const connect = useCallback(async () => {
    if (!(window as any).ethereum) {
      toast.error('Please install MetaMask to continue');
      return;
    }
    setIsConnecting(true);
    try {
      const ethProvider = new BrowserProvider((window as any).ethereum);
      const ethSigner = await ethProvider.getSigner();
      const addr = await ethSigner.getAddress();
      const network = await ethProvider.getNetwork();

      setProvider(ethProvider);
      setSigner(ethSigner);
      setAddress(addr);
      setChainId(Number(network.chainId));
      await updateBalance(ethProvider, addr);

      const chainName = SUPPORTED_CHAINS[Number(network.chainId)] || `Chain ${network.chainId}`;
      toast.success(`Connected to ${chainName}`);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to connect wallet');
    } finally {
      setIsConnecting(false);
    }
  }, [updateBalance]);

  const disconnect = useCallback(() => {
    setProvider(null);
    setSigner(null);
    setAddress(null);
    setChainId(null);
    setBalance('0');
    toast.success('Wallet disconnected');
  }, []);

  const switchNetwork = useCallback(async (targetChainId: number) => {
    if (!(window as any).ethereum) return;
    try {
      await (window as any).ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${targetChainId.toString(16)}` }],
      });
    } catch (err: any) {
      toast.error(err?.message || 'Failed to switch network');
    }
  }, []);

  useEffect(() => {
    const eth = (window as any).ethereum;
    if (!eth) return;

    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts.length === 0) disconnect();
      else {
        setAddress(accounts[0]);
        if (provider) updateBalance(provider, accounts[0]);
      }
    };

    const handleChainChanged = () => window.location.reload();

    eth.on('accountsChanged', handleAccountsChanged);
    eth.on('chainChanged', handleChainChanged);
    return () => {
      eth.removeListener('accountsChanged', handleAccountsChanged);
      eth.removeListener('chainChanged', handleChainChanged);
    };
  }, [provider, disconnect, updateBalance]);

  // Auto-connect if previously connected
  useEffect(() => {
    const eth = (window as any).ethereum;
    if (eth?.selectedAddress) connect();
  }, [connect]);

  return (
    <Web3Context.Provider
      value={{
        provider, signer, address, chainId, balance,
        isConnecting, isConnected: !!address,
        connect, disconnect, switchNetwork,
      }}
    >
      {children}
    </Web3Context.Provider>
  );
}

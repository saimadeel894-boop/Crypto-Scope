'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { BrowserProvider, formatEther } from 'ethers';

declare global {
  interface Window {
    ethereum?: any;
  }
}

export interface NetworkInfo {
  chainId: string;
  name: string;
  symbol: string;
}

interface WalletContextType {
  isMetaMaskInstalled: boolean;
  account: string | null;
  isConnecting: boolean;
  error: string | null;
  balance: string;
  network: NetworkInfo | null;
  isOpen: boolean;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
  toggleWalletMenu: () => void;
  switchNetwork: (chainIdHex: string) => Promise<void>;
}

const THETA_MAINNET_PARAMS = {
  chainId: '0x169', // 361
  chainName: 'Theta Mainnet',
  nativeCurrency: {
    name: 'Theta Fuel',
    symbol: 'TFUEL',
    decimals: 18,
  },
  rpcUrls: ['https://eth-rpc-api.thetatoken.org/rpc'],
  blockExplorerUrls: ['https://explorer.thetatoken.org'],
};

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export const WalletProvider = ({ children }: { children: React.ReactNode }) => {
  const [isMetaMaskInstalled, setIsMetaMaskInstalled] = useState(false);
  const [account, setAccount] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [balance, setBalance] = useState<string>('0');
  const [network, setNetwork] = useState<NetworkInfo | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const getEthereumProvider = useCallback(() => {
    if (typeof window === 'undefined') return undefined;
    const eth = window.ethereum;
    if (!eth) return undefined;

    if (Array.isArray(eth.providers) && eth.providers.length > 0) {
      const metaMaskProvider = eth.providers.find((p: any) => p.isMetaMask);
      if (metaMaskProvider) return metaMaskProvider;
      return eth.providers[0];
    }
    return eth;
  }, []);

  const getNetworkInfo = (chainIdBigInt: bigint | string): NetworkInfo => {
    const chainId = chainIdBigInt.toString();
    const networks: { [key: string]: { name: string; symbol: string } } = {
      '1': { name: 'Ethereum Mainnet', symbol: 'ETH' },
      '5': { name: 'Goerli Testnet', symbol: 'ETH' },
      '11155111': { name: 'Sepolia Testnet', symbol: 'ETH' },
      '137': { name: 'Polygon Mainnet', symbol: 'MATIC' },
      '80001': { name: 'Mumbai Testnet', symbol: 'MATIC' },
      '361': { name: 'Theta Mainnet', symbol: 'TFUEL' },
      '365': { name: 'Theta Testnet', symbol: 'TFUEL' },
    };
    const net = networks[chainId];
    return {
      chainId,
      name: net ? net.name : `Chain ID: ${chainId}`,
      symbol: net ? net.symbol : 'ETH',
    };
  };

  const sendWalletToBackend = async (walletAddress: string) => {
    try {
      const response = await fetch('/api/wallet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: walletAddress }),
      });
      const data = await response.json();
      if (!response.ok) {
        console.warn('Backend API wallet response non-ok:', data);
      } else {
        console.log('Wallet address synced to backend DB:', data);
      }
    } catch (err) {
      console.error('Error sending wallet address to backend API:', err);
    }
  };

  const updateAccountData = useCallback(async (address: string) => {
    const eth = getEthereumProvider();
    if (!eth) return;
    try {
      const provider = new BrowserProvider(eth);
      
      const [balanceResult, networkResult] = await Promise.allSettled([
        provider.getBalance(address),
        provider.getNetwork(),
      ]);

      if (balanceResult.status === 'fulfilled') {
        setBalance(parseFloat(formatEther(balanceResult.value)).toFixed(4));
      } else {
        console.warn('Balance fetch error:', balanceResult.reason);
      }

      if (networkResult.status === 'fulfilled') {
        setNetwork(getNetworkInfo(networkResult.value.chainId));
      } else {
        console.warn('Network fetch error:', networkResult.reason);
        setNetwork({ chainId: '1', name: 'Ethereum Mainnet', symbol: 'ETH' });
      }
    } catch (err) {
      console.error('Error updating account data:', err);
    }
  }, [getEthereumProvider]);

  useEffect(() => {
    const checkEthereumProvider = () => {
      const eth = getEthereumProvider();
      const isInstalled = !!eth;
      setIsMetaMaskInstalled(isInstalled);
      return eth;
    };

    let eth = checkEthereumProvider();

    // Check again after short delays in case of delayed injection
    const timer1 = setTimeout(() => { eth = checkEthereumProvider(); }, 500);
    const timer2 = setTimeout(() => { eth = checkEthereumProvider(); }, 1500);

    const checkExistingConnection = async () => {
      const provider = getEthereumProvider();
      if (!provider) return;
      try {
        let accounts: string[] = [];
        if (typeof provider.request === 'function') {
          accounts = await provider.request({ method: 'eth_accounts' });
        } else {
          const bp = new BrowserProvider(provider);
          accounts = await bp.send('eth_accounts', []);
        }

        if (accounts && accounts.length > 0) {
          const currentAccount = accounts[0];
          setAccount(currentAccount);
          updateAccountData(currentAccount);
          sendWalletToBackend(currentAccount);
        }
      } catch (err) {
        console.error('Error checking existing connection:', err);
      }
    };

    checkExistingConnection();

    const handleInitialized = () => {
      checkEthereumProvider();
      checkExistingConnection();
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('ethereum#initialized', handleInitialized, { once: true });
    }

    const handleAccountsChanged = async (accounts: string[]) => {
      if (!accounts || accounts.length === 0) {
        setAccount(null);
        setBalance('0');
        setNetwork(null);
        setIsOpen(false);
      } else {
        const newAccount = accounts[0];
        setAccount(newAccount);
        updateAccountData(newAccount);
        sendWalletToBackend(newAccount);
      }
    };

    const handleChainChanged = () => {
      const activeEth = getEthereumProvider();
      if (activeEth) {
        window.location.reload();
      }
    };

    const activeProvider = getEthereumProvider();
    if (activeProvider && typeof activeProvider.on === 'function') {
      activeProvider.on('accountsChanged', handleAccountsChanged);
      activeProvider.on('chainChanged', handleChainChanged);
    }

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      if (typeof window !== 'undefined') {
        window.removeEventListener('ethereum#initialized', handleInitialized);
      }
      const p = getEthereumProvider();
      if (p && typeof p.removeListener === 'function') {
        p.removeListener('accountsChanged', handleAccountsChanged);
        p.removeListener('chainChanged', handleChainChanged);
      }
    };
  }, [getEthereumProvider, updateAccountData]);

  const connectWallet = async () => {
    setError(null);

    const eth = getEthereumProvider();

    if (!eth) {
      const noWeb3Msg = 'No Web3 wallet extension found. Please install MetaMask or another Ethereum wallet extension.';
      setError(noWeb3Msg);
      if (typeof window !== 'undefined') {
        window.open('https://metamask.io/download/', '_blank');
      }
      return;
    }

    setIsConnecting(true);

    try {
      let accounts: string[] = [];

      if (typeof eth.request === 'function') {
        accounts = await eth.request({ method: 'eth_requestAccounts' });
      } else {
        const provider = new BrowserProvider(eth);
        accounts = await provider.send('eth_requestAccounts', []);
      }

      if (accounts && accounts.length > 0) {
        const connectedAccount = accounts[0];
        setAccount(connectedAccount);
        setIsOpen(true);
        updateAccountData(connectedAccount);
        sendWalletToBackend(connectedAccount);
      } else {
        setError('No account returned from wallet.');
      }
    } catch (err: any) {
      console.error('Error connecting wallet:', err);
      if (
        err?.code === 4001 || 
        err?.code === 'ACTION_REJECTED' ||
        (typeof err?.message === 'string' && err.message.toLowerCase().includes('user rejected')) ||
        (typeof err?.message === 'string' && err.message.toLowerCase().includes('rejected'))
      ) {
        setError('Connection request rejected by user.');
      } else if (err?.code === -32002) {
        setError('Connection request is already pending in your wallet extension. Please check MetaMask.');
      } else {
        setError(err?.message || 'Failed to connect wallet.');
      }
    } finally {
      setIsConnecting(false);
    }
  };

  const switchNetwork = async (chainIdHex: string) => {
    const eth = getEthereumProvider();
    if (!eth) {
      setError('No Web3 wallet extension found.');
      return;
    }
    try {
      await eth.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: chainIdHex }],
      });
    } catch (switchError: any) {
      if (switchError?.code === 4902 && chainIdHex === '0x169') {
        try {
          await eth.request({
            method: 'wallet_addEthereumChain',
            params: [THETA_MAINNET_PARAMS],
          });
        } catch (addError: any) {
          console.error('Error adding Theta network:', addError);
          setError('Failed to add Theta Mainnet to wallet.');
        }
      } else {
        console.error('Error switching network:', switchError);
        setError(switchError?.message || 'Failed to switch network.');
      }
    }
  };

  const disconnectWallet = () => {
    setAccount(null);
    setBalance('0');
    setNetwork(null);
    setIsOpen(false);
  };

  const toggleWalletMenu = () => {
    setIsOpen(prev => !prev);
  };

  return (
    <WalletContext.Provider
      value={{
        isMetaMaskInstalled,
        account,
        isConnecting,
        error,
        balance,
        network,
        isOpen,
        connectWallet,
        disconnectWallet,
        toggleWalletMenu,
        switchNetwork,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
};

export const useWallet = () => {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
};
'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { ethers, BrowserProvider, formatEther } from 'ethers';

declare global {
  interface Window {
    ethereum?: any;
  }
}

interface NetworkInfo {
  chainId: string;
  name: string;
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
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export const WalletProvider = ({ children }: { children: React.ReactNode }) => {
  const [isMetaMaskInstalled, setIsMetaMaskInstalled] = useState(false);
  const [account, setAccount] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [balance, setBalance] = useState<string>('0');
  const [network, setNetwork] = useState<NetworkInfo | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const getNetworkInfo = (chainIdBigInt: bigint | string): NetworkInfo => {
    const chainId = chainIdBigInt.toString();
    const networks: { [key: string]: string } = {
      '1': 'Ethereum Mainnet',
      '5': 'Goerli Testnet',
      '11155111': 'Sepolia Testnet',
      '137': 'Polygon Mainnet',
      '80001': 'Mumbai Testnet',
      '361': 'Theta Mainnet',
    };
    return {
      chainId,
      name: networks[chainId] || `Chain ID: ${chainId}`,
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
    if (typeof window === 'undefined' || !window.ethereum) return;
    try {
      const provider = new BrowserProvider(window.ethereum);
      
      try {
        const balanceWei = await provider.getBalance(address);
        setBalance(parseFloat(formatEther(balanceWei)).toFixed(4));
      } catch (bErr) {
        console.warn('Balance fetch error:', bErr);
      }

      try {
        const networkObj = await provider.getNetwork();
        setNetwork(getNetworkInfo(networkObj.chainId));
      } catch (nErr) {
        console.warn('Network fetch error:', nErr);
        setNetwork({ chainId: '1', name: 'Ethereum Mainnet' });
      }
    } catch (err) {
      console.error('Error updating account data:', err);
    }
  }, []);

  useEffect(() => {
    const checkEthereumProvider = () => {
      const ethereum = typeof window !== 'undefined' ? window.ethereum : undefined;
      const isInstalled = !!ethereum;
      setIsMetaMaskInstalled(isInstalled);
      return ethereum;
    };

    const ethereum = checkEthereumProvider();

    const checkExistingConnection = async () => {
      const eth = window.ethereum;
      if (!eth) return;
      try {
        let accounts: string[] = [];
        if (typeof eth.request === 'function') {
          accounts = await eth.request({ method: 'eth_accounts' });
        } else {
          const provider = new BrowserProvider(eth);
          accounts = await provider.send('eth_accounts', []);
        }

        if (accounts && accounts.length > 0) {
          const currentAccount = accounts[0];
          setAccount(currentAccount);
          await updateAccountData(currentAccount);
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
        await updateAccountData(newAccount);
        sendWalletToBackend(newAccount);
      }
    };

    const handleChainChanged = () => {
      if (window.ethereum) {
        window.location.reload();
      }
    };

    if (ethereum && typeof ethereum.on === 'function') {
      ethereum.on('accountsChanged', handleAccountsChanged);
      ethereum.on('chainChanged', handleChainChanged);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('ethereum#initialized', handleInitialized);
      }
      if (window.ethereum && typeof window.ethereum.removeListener === 'function') {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
        window.ethereum.removeListener('chainChanged', handleChainChanged);
      }
    };
  }, [updateAccountData]);

  const connectWallet = async () => {
    setError(null);

    const eth = typeof window !== 'undefined' ? window.ethereum : undefined;

    if (!eth) {
      setError('No Web3 wallet extension found. Please install MetaMask or another Ethereum wallet extension.');
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
        await updateAccountData(connectedAccount);
        setIsOpen(true);

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
      } else {
        setError(err?.message || 'Failed to connect wallet.');
      }
    } finally {
      setIsConnecting(false);
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
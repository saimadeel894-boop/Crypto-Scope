import { useState, useEffect, useCallback } from 'react';
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

export const useWallet = () => {
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
    if (!window.ethereum) return;
    try {
      const provider = new BrowserProvider(window.ethereum);
      const balanceWei = await provider.getBalance(address);
      setBalance(parseFloat(formatEther(balanceWei)).toFixed(4));

      const networkObj = await provider.getNetwork();
      setNetwork(getNetworkInfo(networkObj.chainId));
    } catch (err) {
      console.error('Error updating account data:', err);
    }
  }, []);

  useEffect(() => {
    const isInstalled = !!window.ethereum?.isMetaMask;
    setIsMetaMaskInstalled(isInstalled);

    const checkConnection = async () => {
      if (window.ethereum) {
        try {
          const provider = new BrowserProvider(window.ethereum);
          const accounts: string[] = await provider.send('eth_accounts', []);
          if (accounts && accounts.length > 0) {
            const currentAccount = accounts[0];
            setAccount(currentAccount);
            await updateAccountData(currentAccount);
            sendWalletToBackend(currentAccount);
          }
        } catch (err) {
          console.error('Error checking existing connection:', err);
        }
      }
    };

    checkConnection();

    const handleAccountsChanged = async (accounts: string[]) => {
      if (accounts.length === 0) {
        setAccount(null);
        setBalance('0');
        setNetwork(null);
      } else {
        const newAccount = accounts[0];
        setAccount(newAccount);
        await updateAccountData(newAccount);
        sendWalletToBackend(newAccount);
      }
    };

    const handleChainChanged = () => {
      if (account) {
        updateAccountData(account);
      }
    };

    if (window.ethereum) {
      window.ethereum.on('accountsChanged', handleAccountsChanged);
      window.ethereum.on('chainChanged', handleChainChanged);
    }

    return () => {
      if (window.ethereum?.removeListener) {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
        window.ethereum.removeListener('chainChanged', handleChainChanged);
      }
    };
  }, [account, updateAccountData]);

  const connectWallet = async () => {
    setError(null);

    if (!window.ethereum) {
      setError('MetaMask is not installed. Please install the MetaMask browser extension.');
      return;
    }

    setIsConnecting(true);

    try {
      // Create BrowserProvider using ethers.js
      const provider = new BrowserProvider(window.ethereum);
      
      // Request accounts using BrowserProvider
      const accounts: string[] = await provider.send('eth_requestAccounts', []);
      
      if (accounts && accounts.length > 0) {
        const connectedAccount = accounts[0];
        setAccount(connectedAccount);
        await updateAccountData(connectedAccount);
        setIsOpen(true);

        // Send address to backend API POST endpoint
        await sendWalletToBackend(connectedAccount);
      } else {
        setError('No account returned from MetaMask.');
      }
    } catch (err: any) {
      console.error('Error connecting MetaMask wallet:', err);
      // Handle user rejection or missing extension explicitly
      if (
        err?.code === 4001 || 
        err?.code === 'ACTION_REJECTED' ||
        (typeof err?.message === 'string' && err.message.toLowerCase().includes('user rejected'))
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

  return {
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
  };
};
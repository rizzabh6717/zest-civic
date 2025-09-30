import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { ethers } from 'ethers';
import { authAPI } from '@/services/api';
import { contractService, ContractService } from '@/services/contractService';

interface Web3ContextType {
  account: string | null;
  isConnected: boolean;
  isAuthenticated: boolean;
  userType: 'citizen' | 'worker' | 'dao' | null;
  user: any | null;
  contract: ContractService;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
  setUserType: (type: 'citizen' | 'worker' | 'dao') => void;
  authenticateUser: (userType: 'citizen' | 'worker' | 'dao') => Promise<boolean>;
}

const Web3Context = createContext<Web3ContextType | undefined>(undefined);

export function Web3Provider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userType, setUserType] = useState<'citizen' | 'worker' | 'dao' | null>(null);
  const [user, setUser] = useState<any | null>(null);
  const [providerError, setProviderError] = useState<string | null>(null);

  const connectWallet = async () => {
    try {
      if (typeof window.ethereum !== 'undefined') {
        const accounts = await window.ethereum.request({
          method: 'eth_requestAccounts',
        });
        
        if (accounts.length > 0) {
          setAccount(accounts[0]);
          setIsConnected(true);
          
          // Initialize contract with signer
          const provider = new ethers.BrowserProvider(window.ethereum);
          const signer = await provider.getSigner();
          await contractService.initialize(signer);
          
          // Check if user was previously authenticated
          const savedToken = localStorage.getItem('auth_token');
          const savedUserType = localStorage.getItem('user_type');
          
          if (savedToken && savedUserType) {
            try {
              const profileResponse = await authAPI.getProfile();
              if (profileResponse.success) {
                setUser(profileResponse.data);
                setUserType(profileResponse.data.user_type);
                setIsAuthenticated(true);
              }
            } catch (error) {
              // Token is invalid, clear it
              localStorage.removeItem('auth_token');
              localStorage.removeItem('user_type');
            }
          }
        }
      } else {
        alert('MetaMask is not installed. Please install MetaMask to continue.');
      }
    } catch (error) {
      console.error('Error connecting to MetaMask:', error);
    }
  };

  const disconnectWallet = () => {
    setAccount(null);
    setIsConnected(false);
    setIsAuthenticated(false);
    setUserType(null);
    setUser(null);
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_type');
    
    // Clean up contract listeners
    contractService.removeAllListeners();
  };

  const authenticateUser = async (selectedUserType: 'citizen' | 'worker' | 'dao'): Promise<boolean> => {
    try {
      if (!account) {
        throw new Error('Wallet not connected');
      }

      // Create authentication message
      const timestamp = new Date().toISOString();
      const message = `Sign this message to authenticate with Zentigrity.\n\nWallet: ${account}\nUser Type: ${selectedUserType}\nTimestamp: ${timestamp}`;

      // Request signature from MetaMask
      const signature = await window.ethereum.request({
        method: 'personal_sign',
        params: [message, account],
      });

      // Authenticate with backend
      console.log('🔐 Authenticating with data:', {
        walletAddress: account,
        signature: signature.substring(0, 20) + '...',
        message: message.substring(0, 50) + '...',
        timestamp,
        userType: selectedUserType
      });

      const authResponse = await authAPI.authenticate({
        walletAddress: account,
        signature,
        message,
        timestamp,
        userType: selectedUserType
      });

      console.log('✅ Auth response:', authResponse);

      if (authResponse.success) {
        // Store authentication data
        localStorage.setItem('auth_token', authResponse.data.token);
        localStorage.setItem('user_type', selectedUserType);
        
        setUser(authResponse.data.user);
        setUserType(selectedUserType);
        setIsAuthenticated(true);
        
        return true;
      } else {
        throw new Error('Authentication failed');
      }
    } catch (error) {
      console.error('Authentication error:', error);
      // Don't throw error if user rejects signature - that's normal
      if (error.code === 4001 || error.message?.includes('User rejected')) {
        console.log('User rejected authentication signature');
        return false;
      }
      return false;
    }
  };

  useEffect(() => {
    // Initialize contract service for read-only operations
    const initializeReadOnlyContract = async () => {
      try {
        await contractService.initialize();
        console.log('Contract service initialized successfully');
      } catch (error) {
        console.error('Failed to initialize read-only contract:', error);
        // Don't crash the app if contract initialization fails
      }
    };

    // Wrap in setTimeout to prevent blocking React initialization
    setTimeout(() => {
      initializeReadOnlyContract();
    }, 100);

    if (typeof window.ethereum !== 'undefined') {
      window.ethereum.on('accountsChanged', (accounts: string[]) => {
        if (accounts.length === 0) {
          disconnectWallet();
        } else {
          setAccount(accounts[0]);
        }
      });
    }

    return () => {
      if (typeof window.ethereum !== 'undefined') {
        window.ethereum.removeAllListeners('accountsChanged');
      }
    };
  }, []);

  // Add error boundary for provider
  if (providerError) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-xl font-bold mb-4">Web3 Provider Error</h1>
          <p className="text-red-400 mb-4">{providerError}</p>
          <button 
            onClick={() => {
              setProviderError(null);
              window.location.reload();
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  try {
    return (
      <Web3Context.Provider
        value={{
          account,
          isConnected,
          isAuthenticated,
          userType,
          user,
          contract: contractService,
          connectWallet,
          disconnectWallet,
          setUserType,
          authenticateUser,
        }}
      >
        {children}
      </Web3Context.Provider>
    );
  } catch (error) {
    console.error('Web3Provider render error:', error);
    setProviderError(error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
}

export function useWeb3() {
  const context = useContext(Web3Context);
  if (context === undefined) {
    throw new Error('useWeb3 must be used within a Web3Provider');
  }
  return context;
}

// Extend Window interface for TypeScript
declare global {
  interface Window {
    ethereum?: any;
  }
}
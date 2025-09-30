// Contract configuration
export const CONTRACT_CONFIG = {
  address: '0x26600f2341f30bb9829bc2fcaa48ae8c0d74736e',
  
  // Network configuration - Update based on your testnet
  networks: {
    fuji: {
      name: 'Avalanche Fuji Testnet',
      chainId: 43113,
      rpcUrl: 'https://api.avax-test.network/ext/bc/C/rpc',
      explorerUrl: 'https://testnet.snowtrace.io'
    },
    sepolia: {
      name: 'Sepolia Testnet',
      chainId: 11155111,
      rpcUrl: 'https://sepolia.infura.io/v3/YOUR_INFURA_KEY',
      explorerUrl: 'https://sepolia.etherscan.io'
    },
    mumbai: {
      name: 'Polygon Mumbai',
      chainId: 80001,
      rpcUrl: 'https://rpc-mumbai.maticvigil.com',
      explorerUrl: 'https://mumbai.polygonscan.com'
    }
  },
  
  // Default network (change this to match your deployment)
  defaultNetwork: 'fuji',
  
  // Contract role hashes (these are computed by the contract)
  roles: {
    DEFAULT_ADMIN_ROLE: '0x0000000000000000000000000000000000000000000000000000000000000000',
    DAO_ROLE: '0x3b5d4cc60d3ec3516ee8ae083bd60934f6eb2a6c54b1229985c41bfb092b2603',
    WORKER_ROLE: '0x35e65d9b7b2b5b7b4c7e9f7a3bc3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1'
  }
};

// Helper function to get current network config
export const getCurrentNetworkConfig = () => {
  return CONTRACT_CONFIG.networks[CONTRACT_CONFIG.defaultNetwork as keyof typeof CONTRACT_CONFIG.networks];
};

// Helper function to format contract address for display
export const formatAddress = (address: string, length: number = 6): string => {
  if (!address) return '';
  return `${address.substring(0, length)}...${address.substring(address.length - 4)}`;
};

// Helper function to get explorer URL for transaction
export const getTransactionUrl = (txHash: string): string => {
  const network = getCurrentNetworkConfig();
  return `${network.explorerUrl}/tx/${txHash}`;
};

// Helper function to get explorer URL for address
export const getAddressUrl = (address: string): string => {
  const network = getCurrentNetworkConfig();
  return `${network.explorerUrl}/address/${address}`;
};
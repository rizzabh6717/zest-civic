# Zentigrity Smart Contracts

This directory contains all smart contracts for the Zentigrity decentralized grievance redressal platform on Avalanche.

## Contract Architecture

### 1. Core Contracts
- **GrievanceRegistry.sol** - Main registry for all grievances with IPFS metadata
- **EscrowManager.sol** - Manages escrow payments for task assignments
- **DAOGovernance.sol** - Handles DAO voting and governance decisions
- **ReputationManager.sol** - Tracks and manages user reputation scores

### 2. Supporting Contracts
- **ZentToken.sol** - ERC20 utility token for platform governance and payments
- **TaskAssignment.sol** - Manages task assignments and worker selection
- **DisputeResolution.sol** - Handles disputes between citizens and workers

## Dependencies
- OpenZeppelin v4.9.0+ for security standards
- Solidity ^0.8.19

## Deployment Order
1. ZentToken (if using custom token)
2. ReputationManager
3. GrievanceRegistry
4. EscrowManager
5. TaskAssignment
6. DAOGovernance
7. DisputeResolution

## Environment Setup

### Prerequisites
```bash
npm install -g hardhat
npm install @openzeppelin/contracts
npm install @nomiclabs/hardhat-ethers ethers
```

### Configuration
Create `hardhat.config.js` with Avalanche network configuration.

### Deployment
```bash
npx hardhat compile
npx hardhat deploy --network avalanche-testnet
```

## Post-Deployment Integration

After deploying contracts, update the backend `.env` file:
```env
# Contract Addresses (you'll get these after deployment)
GRIEVANCE_REGISTRY_ADDRESS=0x...
ESCROW_MANAGER_ADDRESS=0x...
DAO_GOVERNANCE_ADDRESS=0x...
REPUTATION_MANAGER_ADDRESS=0x...
ZENT_TOKEN_ADDRESS=0x... (if using custom token)

# DAO Configuration
DAO_WALLET_PRIVATE_KEY=your_dao_wallet_private_key
AVALANCHE_RPC_URL=https://api.avax-test.network/ext/bc/C/rpc
AVALANCHE_CHAIN_ID=43113
```

## Security Considerations
- All contracts use OpenZeppelin's security standards
- Reentrancy protection on all external calls
- Access control with role-based permissions
- Emergency pause functionality for critical contracts
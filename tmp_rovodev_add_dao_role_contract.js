// Script to add DAO role to your wallet in the smart contract
// This needs to be run by the contract owner/admin

import { ethers } from 'ethers';
import contractABI from './contracts/abi.json';

const CONTRACT_ADDRESS = '0x26600f2341f30bb9829bc2fcaa48ae8c0d74736e';
const DAO_ROLE = '0x3b5d4cc60d3ec3516ee8ae083bd60934f6eb2a6c54b1229985c41bfb092b2603';

// Your wallet address that needs DAO role
const YOUR_WALLET_ADDRESS = '0xff85a4c7082c12251c80fdf4b7f46ca04e6c43d9'; // Replace with your actual address

async function addDAORole() {
  try {
    // Connect to network (make sure you're on the right network)
    const provider = new ethers.JsonRpcProvider('https://api.avax-test.network/ext/bc/C/rpc');
    
    // You need the private key of the contract admin/owner
    const adminPrivateKey = 'YOUR_ADMIN_PRIVATE_KEY'; // Replace with admin private key
    const adminWallet = new ethers.Wallet(adminPrivateKey, provider);
    
    // Connect to contract
    const contract = new ethers.Contract(CONTRACT_ADDRESS, contractABI, adminWallet);
    
    console.log('🔗 Connected to contract:', CONTRACT_ADDRESS);
    console.log('👤 Admin wallet:', adminWallet.address);
    console.log('🎯 Adding DAO role to:', YOUR_WALLET_ADDRESS);
    
    // Grant DAO role
    const tx = await contract.grantRole(DAO_ROLE, YOUR_WALLET_ADDRESS);
    console.log('📤 Transaction sent:', tx.hash);
    
    // Wait for confirmation
    const receipt = await tx.wait();
    console.log('✅ DAO role granted! Block:', receipt.blockNumber);
    
    // Verify the role was granted
    const hasRole = await contract.hasRole(DAO_ROLE, YOUR_WALLET_ADDRESS);
    console.log('🔍 Role verification:', hasRole ? 'SUCCESS' : 'FAILED');
    
  } catch (error) {
    console.error('❌ Error adding DAO role:', error);
  }
}

// Run the script
addDAORole();
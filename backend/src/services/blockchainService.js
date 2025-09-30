import { ethers } from 'ethers';
import Grievance from '../models/Grievance.js';
import TaskAssignment from '../models/TaskAssignment.js';

// Initialize provider and wallet
const provider = new ethers.JsonRpcProvider(process.env.AVALANCHE_RPC_URL);
const daoWallet = process.env.DAO_WALLET_PRIVATE_KEY 
  ? new ethers.Wallet(process.env.DAO_WALLET_PRIVATE_KEY, provider)
  : null;

// ZentSimple Contract ABI - Simplified 5 transaction types
const ZENT_SIMPLE_ABI = [
  // 1. GrievanceRegistry (Submit Grievance)
  "function submitGrievance(string memory _dataHash) external returns (uint256)",
  
  // 2. submitBid (Worker Bid Submission)  
  "function submitBid(uint256 _grievanceId, uint256 _bidAmountINR) external returns (uint256)",
  
  // 3. TaskAssignment (DAO Assigns Task)
  "function assignTask(uint256 _grievanceId, uint256 _winningBidId) external payable",
  
  // 4. workComplete (Task Resolution Proof)
  "function submitWorkComplete(uint256 _grievanceId, string memory _proofHash) external",
  
  // 5. EscrowManager (Funds Release)
  "function citizenConfirmCompletion(uint256 _grievanceId) external",
  "function daoConfirmCompletion(uint256 _grievanceId) external",
  
  // View functions
  "function getGrievance(uint256 _grievanceId) external view returns (tuple(uint256 id, address citizen, string dataHash, uint256 timestamp, uint8 status, address assignedWorker, uint256 escrowAmount, bool isActive))",
  "function getGrievanceBids(uint256 _grievanceId) external view returns (uint256[])",
  "function getBid(uint256 _bidId) external view returns (tuple(uint256 id, uint256 grievanceId, address worker, uint256 bidAmountAVAX, uint256 bidAmountINR, uint256 timestamp, bool isActive))",
  "function getTaskCompletion(uint256 _grievanceId) external view returns (tuple(uint256 grievanceId, address worker, string proofHash, uint256 timestamp, bool citizenConfirmed, bool daoConfirmed))",
  "function getOpenGrievances() external view returns (uint256[])",
  "function getDashboardStats() external view returns (uint256, uint256, uint256, uint256, uint256, uint256)",
  
  // Price conversion
  "function convertINRToAVAX(uint256 _amountINR) external view returns (uint256)",
  "function convertAVAXToINR(uint256 _amountAVAX) external view returns (uint256)",
  "function updateAVAXPrice(uint256 _newPriceINR) external",
  
  // Events
  "event GrievanceSubmitted(uint256 indexed grievanceId, address indexed citizen, string dataHash, uint256 timestamp)",
  "event BidSubmitted(uint256 indexed bidId, uint256 indexed grievanceId, address indexed worker, uint256 bidAmountAVAX, uint256 bidAmountINR, uint256 timestamp)",
  "event TaskAssigned(uint256 indexed grievanceId, address indexed worker, uint256 escrowAmount)",
  "event TaskCompleted(uint256 indexed grievanceId, address indexed worker, string proofHash, uint256 timestamp)",
  "event FundsReleased(uint256 indexed grievanceId, address indexed worker, uint256 amount, uint256 platformFee)"
];

// ===========================================
// 1. GRIEVANCE REGISTRY (Submit Grievance)
// ===========================================

export const submitGrievanceToBlockchain = async (grievanceId, dataHash) => {
  try {
    if (!daoWallet || !process.env.ZENT_SIMPLE_ADDRESS) {
      console.log('Blockchain not configured, using mock transaction');
      return createMockTransaction(grievanceId, 'grievance_submission');
    }

    console.log(`Submitting grievance to blockchain: ${grievanceId}`);

    const zentSimple = new ethers.Contract(
      process.env.ZENT_SIMPLE_ADDRESS,
      ZENT_SIMPLE_ABI,
      daoWallet
    );

    // Submit grievance to blockchain with database hash
    const tx = await zentSimple.submitGrievance(dataHash);
    console.log(`Grievance submission transaction sent: ${tx.hash}`);
    
    const receipt = await tx.wait();
    console.log(`Grievance submitted in block: ${receipt.blockNumber}`);

    // Extract grievance ID from events
    const event = receipt.logs.find(log => {
      try {
        const parsed = zentSimple.interface.parseLog(log);
        return parsed.name === 'GrievanceSubmitted';
      } catch {
        return false;
      }
    });

    let blockchainGrievanceId = null;
    if (event) {
      const parsed = zentSimple.interface.parseLog(event);
      blockchainGrievanceId = parsed.args.grievanceId.toString();
    }

    // Update grievance with blockchain info
    await Grievance.findByIdAndUpdate(grievanceId, {
      blockchain_tx_hash: tx.hash,
      blockchain_block_number: receipt.blockNumber,
      blockchain_grievance_id: blockchainGrievanceId,
      status: 'active'
    });

    return {
      success: true,
      transactionHash: tx.hash,
      blockNumber: receipt.blockNumber,
      blockchainGrievanceId: blockchainGrievanceId
    };

  } catch (error) {
    console.error('Grievance submission to blockchain failed:', error);
    return createMockTransaction(grievanceId, 'grievance_submission');
  }
};

// ===========================================
// 2. SUBMIT BID (Worker Bid Submission)
// ===========================================

export const submitBidToBlockchain = async (bidId, grievanceId, bidAmountINR, workerAddress) => {
  try {
    if (!daoWallet || !process.env.ZENT_SIMPLE_ADDRESS) {
      console.log('Blockchain not configured, using mock transaction');
      return createMockBidTransaction(bidId);
    }

    console.log(`Submitting bid to blockchain: ${bidId} for grievance ${grievanceId}`);

    const zentSimple = new ethers.Contract(
      process.env.ZENT_SIMPLE_ADDRESS,
      ZENT_SIMPLE_ABI,
      daoWallet
    );

    // Worker submits bid (convert INR to proper format: 120.50 INR = 12050)
    const bidAmountINRFormatted = Math.round(bidAmountINR * 100); // Convert to 2 decimal format
    
    const tx = await zentSimple.connect(workerAddress).submitBid(
      grievanceId,
      bidAmountINRFormatted
    );

    console.log(`Bid submission transaction sent: ${tx.hash}`);
    
    const receipt = await tx.wait();
    console.log(`Bid submitted in block: ${receipt.blockNumber}`);

    return {
      success: true,
      transactionHash: tx.hash,
      blockNumber: receipt.blockNumber,
      bidAmountINR: bidAmountINR
    };

  } catch (error) {
    console.error('Bid submission to blockchain failed:', error);
    return createMockBidTransaction(bidId);
  }
};

// ===========================================
// 3. TASK ASSIGNMENT (DAO Assigns Task)
// ===========================================

export const assignTaskOnBlockchain = async (grievanceId, winningBidId, escrowAmountAVAX) => {
  try {
    if (!daoWallet || !process.env.ZENT_SIMPLE_ADDRESS) {
      console.log('Blockchain not configured, using mock transaction');
      return createMockAssignmentTransaction(grievanceId);
    }

    console.log(`Assigning task on blockchain: ${grievanceId} to bid ${winningBidId}`);

    const zentSimple = new ethers.Contract(
      process.env.ZENT_SIMPLE_ADDRESS,
      ZENT_SIMPLE_ABI,
      daoWallet
    );

    // DAO assigns task and locks escrow
    const tx = await zentSimple.assignTask(grievanceId, winningBidId, {
      value: ethers.parseEther(escrowAmountAVAX.toString())
    });

    console.log(`Task assignment transaction sent: ${tx.hash}`);
    
    const receipt = await tx.wait();
    console.log(`Task assigned in block: ${receipt.blockNumber}`);

    return {
      success: true,
      txHash: tx.hash, // Changed from transactionHash to txHash
      blockNumber: receipt.blockNumber,
      escrowAmount: escrowAmountAVAX
    };

  } catch (error) {
    console.error('Task assignment on blockchain failed:', error);
    return createMockAssignmentTransaction(grievanceId);
  }
};

// ===========================================
// 4. WORK COMPLETE (Task Resolution Proof)
// ===========================================

export const submitWorkCompleteToBlockchain = async (grievanceId, proofHash, workerAddress) => {
  try {
    if (!daoWallet || !process.env.ZENT_SIMPLE_ADDRESS) {
      console.log('Blockchain not configured, using mock transaction');
      return createMockCompletionTransaction(grievanceId);
    }

    console.log(`Submitting work completion to blockchain: ${grievanceId}`);

    const zentSimple = new ethers.Contract(
      process.env.ZENT_SIMPLE_ADDRESS,
      ZENT_SIMPLE_ABI,
      daoWallet
    );

    // Worker submits completion proof with database hash
    const tx = await zentSimple.connect(workerAddress).submitWorkComplete(
      grievanceId,
      proofHash
    );

    console.log(`Work completion transaction sent: ${tx.hash}`);
    
    const receipt = await tx.wait();
    console.log(`Work completion submitted in block: ${receipt.blockNumber}`);

    return {
      success: true,
      transactionHash: tx.hash,
      blockNumber: receipt.blockNumber,
      proofHash: proofHash
    };

  } catch (error) {
    console.error('Work completion submission to blockchain failed:', error);
    return createMockCompletionTransaction(grievanceId);
  }
};

// ===========================================
// 5. ESCROW MANAGER (Funds Release)
// ===========================================

export const confirmCompletionOnBlockchain = async (grievanceId, confirmerType, confirmerAddress) => {
  try {
    if (!daoWallet || !process.env.ZENT_SIMPLE_ADDRESS) {
      console.log('Blockchain not configured, using mock transaction');
      return createMockConfirmationTransaction(grievanceId);
    }

    console.log(`Confirming completion on blockchain: ${grievanceId} by ${confirmerType}`);

    const zentSimple = new ethers.Contract(
      process.env.ZENT_SIMPLE_ADDRESS,
      ZENT_SIMPLE_ABI,
      daoWallet
    );

    let tx;
    if (confirmerType === 'citizen') {
      tx = await zentSimple.connect(confirmerAddress).citizenConfirmCompletion(grievanceId);
    } else if (confirmerType === 'dao') {
      tx = await zentSimple.daoConfirmCompletion(grievanceId);
    } else {
      throw new Error('Invalid confirmer type');
    }

    console.log(`Confirmation transaction sent: ${tx.hash}`);
    
    const receipt = await tx.wait();
    console.log(`Confirmation submitted in block: ${receipt.blockNumber}`);

    // Check if funds were released (look for FundsReleased event)
    const fundsReleasedEvent = receipt.logs.find(log => {
      try {
        const parsed = zentSimple.interface.parseLog(log);
        return parsed.name === 'FundsReleased';
      } catch {
        return false;
      }
    });

    let fundsReleased = false;
    let releasedAmount = null;
    let platformFee = null;

    if (fundsReleasedEvent) {
      const parsed = zentSimple.interface.parseLog(fundsReleasedEvent);
      fundsReleased = true;
      releasedAmount = ethers.formatEther(parsed.args.amount);
      platformFee = ethers.formatEther(parsed.args.platformFee);
    }

    return {
      success: true,
      transactionHash: tx.hash,
      blockNumber: receipt.blockNumber,
      confirmerType: confirmerType,
      fundsReleased: fundsReleased,
      releasedAmount: releasedAmount,
      platformFee: platformFee
    };

  } catch (error) {
    console.error('Confirmation on blockchain failed:', error);
    return createMockConfirmationTransaction(grievanceId);
  }
};

// ===========================================
// INR TO AVAX CONVERSION FUNCTIONS
// ===========================================

export const getAVAXPriceInINR = async () => {
  try {
    if (!process.env.ZENT_SIMPLE_ADDRESS) {
      // Fallback to environment variable or default
      return parseFloat(process.env.AVAX_PRICE_INR) || 2500; // Default: 1 AVAX = 2500 INR
    }

    const zentSimple = new ethers.Contract(
      process.env.ZENT_SIMPLE_ADDRESS,
      ZENT_SIMPLE_ABI,
      provider
    );

    // Get current AVAX price from contract (already in correct format)
    const priceWithDecimals = await zentSimple.avaxPriceINR();
    return parseInt(priceWithDecimals.toString()) / 100; // Convert back from 2 decimal format

  } catch (error) {
    console.error('Failed to get AVAX price from blockchain:', error);
    return 2500; // Fallback price
  }
};

export const convertINRToAVAX = async (amountINR) => {
  try {
    if (!process.env.ZENT_SIMPLE_ADDRESS) {
      const avaxPrice = await getAVAXPriceInINR();
      return amountINR / avaxPrice;
    }

    const zentSimple = new ethers.Contract(
      process.env.ZENT_SIMPLE_ADDRESS,
      ZENT_SIMPLE_ABI,
      provider
    );

    const amountINRFormatted = Math.round(amountINR * 100); // Convert to 2 decimal format
    const avaxAmount = await zentSimple.convertINRToAVAX(amountINRFormatted);
    
    return parseFloat(ethers.formatEther(avaxAmount));

  } catch (error) {
    console.error('INR to AVAX conversion failed:', error);
    const avaxPrice = await getAVAXPriceInINR();
    return amountINR / avaxPrice;
  }
};

export const convertAVAXToINR = async (amountAVAX) => {
  try {
    if (!process.env.ZENT_SIMPLE_ADDRESS) {
      const avaxPrice = await getAVAXPriceInINR();
      return amountAVAX * avaxPrice;
    }

    const zentSimple = new ethers.Contract(
      process.env.ZENT_SIMPLE_ADDRESS,
      ZENT_SIMPLE_ABI,
      provider
    );

    const avaxAmountWei = ethers.parseEther(amountAVAX.toString());
    const inrAmount = await zentSimple.convertAVAXToINR(avaxAmountWei);
    
    return parseInt(inrAmount.toString()) / 100; // Convert back from 2 decimal format

  } catch (error) {
    console.error('AVAX to INR conversion failed:', error);
    const avaxPrice = await getAVAXPriceInINR();
    return amountAVAX * avaxPrice;
  }
};

export const updateAVAXPrice = async (newPriceINR) => {
  try {
    if (!daoWallet || !process.env.ZENT_SIMPLE_ADDRESS) {
      console.log('Cannot update AVAX price: blockchain not configured');
      return { success: false, error: 'Blockchain not configured' };
    }

    const zentSimple = new ethers.Contract(
      process.env.ZENT_SIMPLE_ADDRESS,
      ZENT_SIMPLE_ABI,
      daoWallet
    );

    const priceFormatted = Math.round(newPriceINR * 100); // Convert to 2 decimal format
    const tx = await zentSimple.updateAVAXPrice(priceFormatted);
    
    console.log(`AVAX price update transaction sent: ${tx.hash}`);
    
    const receipt = await tx.wait();
    console.log(`AVAX price updated in block: ${receipt.blockNumber}`);

    return {
      success: true,
      transactionHash: tx.hash,
      blockNumber: receipt.blockNumber,
      newPrice: newPriceINR
    };

  } catch (error) {
    console.error('AVAX price update failed:', error);
    return { success: false, error: error.message };
  }
};

// Release escrow payment to worker
export const releaseEscrowPayment = async (assignmentId) => {
  try {
    const assignment = await TaskAssignment.findById(assignmentId);
    if (!assignment) {
      throw new Error('Task assignment not found');
    }

    if (!assignment.payment.escrow_id) {
      throw new Error('No escrow ID found for assignment');
    }

    if (!daoWallet || !process.env.ESCROW_CONTRACT_ADDRESS) {
      console.log('Escrow contract not configured, using mock release');
      return mockEscrowRelease(assignmentId);
    }

    console.log(`Releasing escrow for assignment: ${assignmentId}`);

    const escrowContract = new ethers.Contract(
      process.env.ESCROW_CONTRACT_ADDRESS,
      ESCROW_ABI,
      daoWallet
    );

    // Release escrow
    const tx = await escrowContract.releaseEscrow(
      assignment.payment.escrow_id,
      assignment.worker_id,
      { gasLimit: 150000 }
    );

    console.log(`Escrow release transaction sent: ${tx.hash}`);
    
    const receipt = await tx.wait();
    console.log(`Escrow release confirmed in block: ${receipt.blockNumber}`);

    // Update assignment with payment info
    await TaskAssignment.findByIdAndUpdate(assignmentId, {
      'payment.escrow_released': true,
      'payment.release_tx_hash': tx.hash,
      'payment.release_block_number': receipt.blockNumber,
      'payment.released_at': new Date(),
      'payment.release_amount': assignment.escrow_amount
    });

    return {
      success: true,
      transactionHash: tx.hash,
      blockNumber: receipt.blockNumber,
      amount: assignment.escrow_amount
    };

  } catch (error) {
    console.error('Escrow release failed:', error);
    
    // Fallback to mock release
    return mockEscrowRelease(assignmentId);
  }
};

// Dispute escrow (for disputed tasks)
export const disputeEscrow = async (assignmentId, disputeReason) => {
  try {
    const assignment = await TaskAssignment.findById(assignmentId);
    if (!assignment) {
      throw new Error('Task assignment not found');
    }

    if (!assignment.payment.escrow_id) {
      throw new Error('No escrow ID found for assignment');
    }

    if (!daoWallet || !process.env.ESCROW_CONTRACT_ADDRESS) {
      console.log('Escrow contract not configured, using mock dispute');
      return mockEscrowDispute(assignmentId);
    }

    console.log(`Disputing escrow for assignment: ${assignmentId}`);

    const escrowContract = new ethers.Contract(
      process.env.ESCROW_CONTRACT_ADDRESS,
      ESCROW_ABI,
      daoWallet
    );

    // Dispute escrow
    const tx = await escrowContract.disputeEscrow(
      assignment.payment.escrow_id,
      { gasLimit: 100000 }
    );

    console.log(`Escrow dispute transaction sent: ${tx.hash}`);
    
    const receipt = await tx.wait();
    console.log(`Escrow dispute confirmed in block: ${receipt.blockNumber}`);

    // Update assignment with dispute info
    await TaskAssignment.findByIdAndUpdate(assignmentId, {
      'dispute.raised': true,
      'dispute.raised_at': new Date(),
      'dispute.reason': disputeReason,
      'dispute.blockchain_tx_hash': tx.hash
    });

    return {
      success: true,
      transactionHash: tx.hash,
      blockNumber: receipt.blockNumber,
      disputeReason: disputeReason
    };

  } catch (error) {
    console.error('Escrow dispute failed:', error);
    
    // Fallback to mock dispute
    return mockEscrowDispute(assignmentId);
  }
};

// Get blockchain transaction details
export const getTransactionDetails = async (txHash) => {
  try {
    if (!provider) {
      throw new Error('Blockchain provider not configured');
    }

    const tx = await provider.getTransaction(txHash);
    const receipt = await provider.getTransactionReceipt(txHash);

    return {
      success: true,
      transaction: {
        hash: tx.hash,
        from: tx.from,
        to: tx.to,
        value: ethers.formatEther(tx.value),
        gasPrice: ethers.formatUnits(tx.gasPrice, 'gwei'),
        gasLimit: tx.gasLimit.toString(),
        blockNumber: receipt.blockNumber,
        blockHash: receipt.blockHash,
        status: receipt.status === 1 ? 'success' : 'failed',
        gasUsed: receipt.gasUsed.toString()
      }
    };

  } catch (error) {
    console.error('Failed to get transaction details:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Mock implementations for development/testing

// Mock implementations for development/testing
const createMockTransaction = async (grievanceId, transactionType) => {
  const mockTxHash = `0x${Math.random().toString(16).slice(2)}${Math.random().toString(16).slice(2)}`;
  const mockBlockNumber = Math.floor(Math.random() * 1000000) + 1000000;

  // Update grievance with mock blockchain info
  await Grievance.findByIdAndUpdate(grievanceId, {
    blockchain_tx_hash: mockTxHash,
    blockchain_block_number: mockBlockNumber,
    blockchain_grievance_id: Math.floor(Math.random() * 10000) + 1,
    status: 'active'
  });

  console.log(`Mock transaction created: ${mockTxHash} for ${transactionType}: ${grievanceId}`);

  return {
    success: true,
    transactionHash: mockTxHash,
    blockNumber: mockBlockNumber,
    blockchainGrievanceId: Math.floor(Math.random() * 10000) + 1,
    mock: true
  };
};

const createMockBidTransaction = async (bidId) => {
  const mockTxHash = `0x${Math.random().toString(16).slice(2)}${Math.random().toString(16).slice(2)}`;
  const mockBlockNumber = Math.floor(Math.random() * 1000000) + 1000000;

  console.log(`Mock bid transaction created: ${mockTxHash} for bid: ${bidId}`);

  return {
    success: true,
    transactionHash: mockTxHash,
    blockNumber: mockBlockNumber,
    mock: true
  };
};

const createMockAssignmentTransaction = async (grievanceId) => {
  const mockTxHash = `0x${Math.random().toString(16).slice(2)}${Math.random().toString(16).slice(2)}`;
  const mockBlockNumber = Math.floor(Math.random() * 1000000) + 1000000;

  console.log(`Mock assignment transaction created: ${mockTxHash} for grievance: ${grievanceId}`);

  return {
    success: true,
    txHash: mockTxHash, // Changed from transactionHash to txHash
    blockNumber: mockBlockNumber,
    mock: true
  };
};

const createMockCompletionTransaction = async (grievanceId) => {
  const mockTxHash = `0x${Math.random().toString(16).slice(2)}${Math.random().toString(16).slice(2)}`;
  const mockBlockNumber = Math.floor(Math.random() * 1000000) + 1000000;

  console.log(`Mock completion transaction created: ${mockTxHash} for grievance: ${grievanceId}`);

  return {
    success: true,
    transactionHash: mockTxHash,
    blockNumber: mockBlockNumber,
    mock: true
  };
};

const createMockConfirmationTransaction = async (grievanceId) => {
  const mockTxHash = `0x${Math.random().toString(16).slice(2)}${Math.random().toString(16).slice(2)}`;
  const mockBlockNumber = Math.floor(Math.random() * 1000000) + 1000000;

  console.log(`Mock confirmation transaction created: ${mockTxHash} for grievance: ${grievanceId}`);

  return {
    success: true,
    transactionHash: mockTxHash,
    blockNumber: mockBlockNumber,
    confirmerType: 'citizen',
    fundsReleased: Math.random() > 0.5, // Randomly simulate funds release
    releasedAmount: Math.random() * 100,
    platformFee: Math.random() * 5,
    mock: true
  };
};

const createMockEscrow = async (assignmentId, amount) => {
  const mockTxHash = `0x${Math.random().toString(16).slice(2)}${Math.random().toString(16).slice(2)}`;
  const mockBlockNumber = Math.floor(Math.random() * 1000000) + 1000000;
  const mockEscrowId = Math.floor(Math.random() * 10000) + 1;

  // Update assignment with mock escrow info
  await TaskAssignment.findByIdAndUpdate(assignmentId, {
    escrow_tx_hash: mockTxHash,
    escrow_block_number: mockBlockNumber,
    'payment.escrow_id': mockEscrowId.toString()
  });

  console.log(`Mock escrow created: ${mockTxHash} for assignment: ${assignmentId}, amount: ${amount}`);

  return {
    success: true,
    transactionHash: mockTxHash,
    blockNumber: mockBlockNumber,
    escrowId: mockEscrowId.toString(),
    amount: amount,
    mock: true
  };
};

const mockEscrowRelease = async (assignmentId) => {
  const assignment = await TaskAssignment.findById(assignmentId);
  const mockTxHash = `0x${Math.random().toString(16).slice(2)}${Math.random().toString(16).slice(2)}`;
  const mockBlockNumber = Math.floor(Math.random() * 1000000) + 1000000;

  await TaskAssignment.findByIdAndUpdate(assignmentId, {
    'payment.escrow_released': true,
    'payment.release_tx_hash': mockTxHash,
    'payment.release_block_number': mockBlockNumber,
    'payment.released_at': new Date(),
    'payment.release_amount': assignment.escrow_amount
  });

  console.log(`Mock escrow released: ${mockTxHash} for assignment: ${assignmentId}`);

  return {
    success: true,
    transactionHash: mockTxHash,
    blockNumber: mockBlockNumber,
    amount: assignment.escrow_amount,
    mock: true
  };
};

const mockEscrowDispute = async (assignmentId) => {
  const mockTxHash = `0x${Math.random().toString(16).slice(2)}${Math.random().toString(16).slice(2)}`;
  const mockBlockNumber = Math.floor(Math.random() * 1000000) + 1000000;

  await TaskAssignment.findByIdAndUpdate(assignmentId, {
    'dispute.blockchain_tx_hash': mockTxHash
  });

  console.log(`Mock escrow disputed: ${mockTxHash} for assignment: ${assignmentId}`);

  return {
    success: true,
    transactionHash: mockTxHash,
    blockNumber: mockBlockNumber,
    mock: true
  };
};

// Utility function to check if blockchain is properly configured
export const isBlockchainConfigured = () => {
  return !!(process.env.AVALANCHE_RPC_URL && 
           process.env.DAO_WALLET_PRIVATE_KEY && 
           process.env.ZENT_SIMPLE_ADDRESS);
};

// Get current network status
export const getNetworkStatus = async () => {
  try {
    if (!provider) {
      return { connected: false, network: 'none' };
    }

    const network = await provider.getNetwork();
    const blockNumber = await provider.getBlockNumber();

    return {
      connected: true,
      network: network.name,
      chainId: network.chainId.toString(),
      blockNumber: blockNumber,
      configured: isBlockchainConfigured()
    };

  } catch (error) {
    console.error('Failed to get network status:', error);
    return {
      connected: false,
      network: 'error',
      error: error.message
    };
  }
};
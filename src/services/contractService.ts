import { ethers } from 'ethers';
import contractABI from '../../../contracts/abi.json';
import { CONTRACT_CONFIG, getCurrentNetworkConfig } from '@/config/contract';

// Enums matching the contract
export enum GrievanceStatus {
  Open = 0,
  Assigned = 1,
  Completed = 2,
  Resolved = 3
}

// TypeScript interfaces for contract data
export interface Grievance {
  id: number;
  citizen: string;
  dataHash: string;
  timestamp: number;
  status: GrievanceStatus;
  assignedWorker: string;
  escrowAmount: string;
  isActive: boolean;
}

export interface WorkerBid {
  id: number;
  grievanceId: number;
  worker: string;
  bidAmountAVAX: string;
  bidAmountINR: number;
  timestamp: number;
  isActive: boolean;
}

export interface TaskCompletion {
  grievanceId: number;
  worker: string;
  proofHash: string;
  timestamp: number;
  citizenConfirmed: boolean;
  daoConfirmed: boolean;
}

export interface DashboardStats {
  totalGrievances: number;
  totalBids: number;
  openGrievances: number;
  assignedTasks: number;
  completedTasks: number;
  resolvedGrievances: number;
}

export class ContractService {
  private contract: ethers.Contract | null = null;
  private signer: ethers.Signer | null = null;
  private provider: ethers.Provider | null = null;

  constructor() {
    this.initializeProvider();
  }

  private initializeProvider() {
    if (typeof window !== 'undefined' && window.ethereum) {
      this.provider = new ethers.BrowserProvider(window.ethereum);
    } else {
      // Fallback to JSON RPC provider for read-only operations
      const networkConfig = getCurrentNetworkConfig();
      this.provider = new ethers.JsonRpcProvider(networkConfig.rpcUrl);
    }
  }

  async initialize(signer?: ethers.Signer) {
    if (!this.provider) {
      throw new Error('No provider available');
    }

    if (signer) {
      this.signer = signer;
      this.contract = new ethers.Contract(
        CONTRACT_CONFIG.address,
        contractABI,
        signer
      );
    } else {
      // Read-only contract for view functions
      this.contract = new ethers.Contract(
        CONTRACT_CONFIG.address,
        contractABI,
        this.provider
      );
    }
  }

  // ===== CITIZEN FUNCTIONS =====

  async submitGrievance(dataHash: string): Promise<{transactionHash: string, grievanceId: string}> {
    if (!this.contract || !this.signer) {
      throw new Error('Contract not initialized with signer');
    }

    const tx = await this.contract.submitGrievance(dataHash);
    console.log('Transaction sent, hash:', tx.hash);
    
    const receipt = await tx.wait();
    console.log('Transaction confirmed, receipt:', receipt);
    
    // Extract grievance ID from event logs
    const event = receipt.logs?.find((log: any) => {
      try {
        const parsed = this.contract!.interface.parseLog(log);
        return parsed.name === 'GrievanceSubmitted';
      } catch {
        return false;
      }
    });
    
    let grievanceId = '';
    if (event) {
      try {
        const parsed = this.contract.interface.parseLog(event);
        grievanceId = parsed.args?.grievanceId?.toString() || '';
      } catch (error) {
        console.warn('Could not parse grievance ID from event:', error);
      }
    }
    
    return {
      transactionHash: tx.hash,
      grievanceId: grievanceId
    };
  }

  async citizenConfirmCompletion(grievanceId: number): Promise<void> {
    if (!this.contract || !this.signer) {
      throw new Error('Contract not initialized with signer');
    }

    const tx = await this.contract.citizenConfirmCompletion(grievanceId);
    await tx.wait();
  }

  // ===== WORKER FUNCTIONS =====

  async submitBid(grievanceId: number, bidAmountINR: number): Promise<string> {
    if (!this.contract || !this.signer) {
      throw new Error('Contract not initialized with signer');
    }

    // Convert INR to contract format (2 decimals)
    const bidAmountINRScaled = Math.floor(bidAmountINR * 100);
    
    const tx = await this.contract.submitBid(grievanceId, bidAmountINRScaled);
    const receipt = await tx.wait();
    
    // Extract bid ID from event logs
    const event = receipt.events?.find((e: any) => e.event === 'BidSubmitted');
    return event?.args?.bidId?.toString() || '';
  }

  async submitWorkComplete(grievanceId: number, proofHash: string): Promise<void> {
    if (!this.contract || !this.signer) {
      throw new Error('Contract not initialized with signer');
    }

    const tx = await this.contract.submitWorkComplete(grievanceId, proofHash);
    await tx.wait();
  }

  // ===== DAO FUNCTIONS =====

  async assignTask(grievanceId: number, winningBidId: number, escrowAmount: string): Promise<void> {
    if (!this.contract || !this.signer) {
      throw new Error('Contract not initialized with signer');
    }

    const tx = await this.contract.assignTask(grievanceId, winningBidId, {
      value: escrowAmount
    });
    await tx.wait();
  }

  async daoConfirmCompletion(grievanceId: number): Promise<void> {
    if (!this.contract || !this.signer) {
      throw new Error('Contract not initialized with signer');
    }

    const tx = await this.contract.daoConfirmCompletion(grievanceId);
    await tx.wait();
  }

  async grantWorkerRole(workerAddress: string): Promise<void> {
    if (!this.contract || !this.signer) {
      throw new Error('Contract not initialized with signer');
    }

    const tx = await this.contract.grantWorkerRole(workerAddress);
    await tx.wait();
  }

  // ===== VIEW FUNCTIONS =====

  async getGrievance(grievanceId: number): Promise<Grievance> {
    if (!this.contract) {
      throw new Error('Contract not initialized');
    }

    const result = await this.contract.getGrievance(grievanceId);
    return {
      id: Number(result.id),
      citizen: result.citizen,
      dataHash: result.dataHash,
      timestamp: Number(result.timestamp),
      status: result.status,
      assignedWorker: result.assignedWorker,
      escrowAmount: result.escrowAmount.toString(),
      isActive: result.isActive
    };
  }

  async getGrievanceBids(grievanceId: number): Promise<number[]> {
    if (!this.contract) {
      throw new Error('Contract not initialized');
    }

    const result = await this.contract.getGrievanceBids(grievanceId);
    return result.map((id: any) => Number(id));
  }

  async getBid(bidId: number): Promise<WorkerBid> {
    if (!this.contract) {
      throw new Error('Contract not initialized');
    }

    const result = await this.contract.getBid(bidId);
    return {
      id: Number(result.id),
      grievanceId: Number(result.grievanceId),
      worker: result.worker,
      bidAmountAVAX: result.bidAmountAVAX.toString(),
      bidAmountINR: Number(result.bidAmountINR) / 100, // Convert back from scaled format
      timestamp: Number(result.timestamp),
      isActive: result.isActive
    };
  }

  async getTaskCompletion(grievanceId: number): Promise<TaskCompletion> {
    if (!this.contract) {
      throw new Error('Contract not initialized');
    }

    const result = await this.contract.getTaskCompletion(grievanceId);
    return {
      grievanceId: Number(result.grievanceId),
      worker: result.worker,
      proofHash: result.proofHash,
      timestamp: Number(result.timestamp),
      citizenConfirmed: result.citizenConfirmed,
      daoConfirmed: result.daoConfirmed
    };
  }

  async getOpenGrievances(): Promise<number[]> {
    if (!this.contract) {
      throw new Error('Contract not initialized');
    }

    const result = await this.contract.getOpenGrievances();
    return result.map((id: any) => Number(id));
  }

  async getDashboardStats(): Promise<DashboardStats> {
    if (!this.contract) {
      throw new Error('Contract not initialized');
    }

    const result = await this.contract.getDashboardStats();
    return {
      totalGrievances: Number(result.totalGrievances),
      totalBids: Number(result.totalBids),
      openGrievances: Number(result.openGrievances),
      assignedTasks: Number(result.assignedTasks),
      completedTasks: Number(result.completedTasks),
      resolvedGrievances: Number(result.resolvedGrievances)
    };
  }

  // ===== UTILITY FUNCTIONS =====

  async convertINRToAVAX(amountINR: number): Promise<string> {
    if (!this.contract) {
      throw new Error('Contract not initialized');
    }

    const amountINRScaled = Math.floor(amountINR * 100);
    const result = await this.contract.convertINRToAVAX(amountINRScaled);
    return result.toString();
  }

  async convertAVAXToINR(amountAVAX: string): Promise<number> {
    if (!this.contract) {
      throw new Error('Contract not initialized');
    }

    const result = await this.contract.convertAVAXToINR(amountAVAX);
    return Number(result) / 100; // Convert back from scaled format
  }

  async getAVAXPrice(): Promise<number> {
    if (!this.contract) {
      throw new Error('Contract not initialized');
    }

    const result = await this.contract.avaxPriceINR();
    return Number(result) / 100; // Convert back from scaled format
  }

  // ===== ROLE CHECKING =====

  async hasWorkerRole(address: string): Promise<boolean> {
    if (!this.contract) {
      throw new Error('Contract not initialized');
    }

    const workerRole = await this.contract.WORKER_ROLE();
    return await this.contract.hasRole(workerRole, address);
  }

  async hasDAORole(address: string): Promise<boolean> {
    if (!this.contract) {
      throw new Error('Contract not initialized');
    }

    const daoRole = await this.contract.DAO_ROLE();
    return await this.contract.hasRole(daoRole, address);
  }

  // ===== EVENT LISTENING =====

  onGrievanceSubmitted(callback: (grievanceId: number, citizen: string, dataHash: string) => void) {
    if (!this.contract) return;

    this.contract.on('GrievanceSubmitted', (grievanceId, citizen, dataHash, timestamp, event) => {
      callback(Number(grievanceId), citizen, dataHash);
    });
  }

  onBidSubmitted(callback: (bidId: number, grievanceId: number, worker: string, bidAmountINR: number) => void) {
    if (!this.contract) return;

    this.contract.on('BidSubmitted', (bidId, grievanceId, worker, bidAmountAVAX, bidAmountINR, timestamp, event) => {
      callback(Number(bidId), Number(grievanceId), worker, Number(bidAmountINR) / 100);
    });
  }

  onTaskAssigned(callback: (grievanceId: number, worker: string, escrowAmount: string) => void) {
    if (!this.contract) return;

    this.contract.on('TaskAssigned', (grievanceId, worker, escrowAmount, event) => {
      callback(Number(grievanceId), worker, escrowAmount.toString());
    });
  }

  onTaskCompleted(callback: (grievanceId: number, worker: string, proofHash: string) => void) {
    if (!this.contract) return;

    this.contract.on('TaskCompleted', (grievanceId, worker, proofHash, timestamp, event) => {
      callback(Number(grievanceId), worker, proofHash);
    });
  }

  onFundsReleased(callback: (grievanceId: number, worker: string, amount: string, platformFee: string) => void) {
    if (!this.contract) return;

    this.contract.on('FundsReleased', (grievanceId, worker, amount, platformFee, event) => {
      callback(Number(grievanceId), worker, amount.toString(), platformFee.toString());
    });
  }

  // Clean up event listeners
  removeAllListeners() {
    if (this.contract) {
      this.contract.removeAllListeners();
    }
  }
}

// Singleton instance
export const contractService = new ContractService();
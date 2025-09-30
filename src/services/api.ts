import axios from 'axios';

// API configuration
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

// Create axios instance with default configuration
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('auth_token') || localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      // Clear invalid token
      localStorage.removeItem('auth_token');
      window.location.href = '/';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  authenticate: async (authData: {
    walletAddress: string;
    signature: string;
    message: string;
    timestamp: string;
    userType?: string;
  }) => {
    const response = await api.post('/users/auth', authData);
    return response.data;
  },
  
  getProfile: async () => {
    const response = await api.get('/users/profile');
    return response.data;
  },
  
  updateProfile: async (profileData: any) => {
    const response = await api.put('/users/profile', profileData);
    return response.data;
  },
  
  getUserByWallet: async (walletAddress: string) => {
    const response = await api.get(`/users/${walletAddress}`);
    return response.data;
  },
  
  getDashboard: async (userType: string) => {
    const response = await api.get(`/users/dashboard/${userType}`);
    return response.data;
  }
};

// Grievances API
export const grievancesAPI = {
  getGrievances: async (params?: {
    status?: string;
    category?: string;
    priority?: string;
    citizen_id?: string;
    page?: number;
    limit?: number;
    search?: string;
  }) => {
    const response = await api.get('/grievances', { params });
    return response.data;
  },
  
  getMarketplace: async (params?: {
    category?: string;
    priority?: string;
    page?: number;
    limit?: number;
  }) => {
    const response = await api.get('/grievances/marketplace', { params });
    return response.data;
  },
  
  getGrievance: async (id: string) => {
    const response = await api.get(`/grievances/${id}`);
    return response.data;
  },
  
  submitGrievance: async (grievanceData: {
    title: string;
    description: string;
    location: string;
    category?: string;
    image_url?: string;
  }) => {
    const response = await api.post('/grievances', grievanceData);
    return response.data;
  },
  
  updateGrievance: async (id: string, updateData: any) => {
    const response = await api.put(`/grievances/${id}`, updateData);
    return response.data;
  },
  
  deleteGrievance: async (id: string) => {
    const response = await api.delete(`/grievances/${id}`);
    return response.data;
  },
  
  getCitizenGrievances: async (walletAddress: string, params?: {
    page?: number;
    limit?: number;
    status?: string;
  }) => {
    const response = await api.get(`/grievances/citizen/${walletAddress}`, { params });
    return response.data;
  }
};

// Bids API
export const bidsAPI = {
  getBids: async (params?: {
    grievance_id?: string;
    worker_id?: string;
    status?: string;
    page?: number;
    limit?: number;
  }) => {
    const response = await api.get('/bids', { params });
    return response.data;
  },
  
  getGrievanceBids: async (grievanceId: string) => {
    const response = await api.get(`/bids/grievance/${grievanceId}`);
    return response.data;
  },
  
  getWorkerBids: async (walletAddress: string, params?: {
    status?: string;
    page?: number;
    limit?: number;
  }) => {
    const response = await api.get(`/bids/worker/${walletAddress}`, { params });
    return response.data;
  },
  
  submitBid: async (bidData: {
    grievance_id: string;
    bid_amount: number;
    proposal: string;
    estimated_completion_time: number;
    skills_offered?: string[];
  }) => {
    const response = await api.post('/bids', bidData);
    return response.data;
  },
  
  updateBid: async (id: string, updateData: any) => {
    const response = await api.put(`/bids/${id}`, updateData);
    return response.data;
  },
  
  withdrawBid: async (id: string) => {
    const response = await api.delete(`/bids/${id}`);
    return response.data;
  }
};

// DAO API
export const daoAPI = {
  getVotes: async (params?: {
    status?: string;
    proposal_type?: string;
    page?: number;
    limit?: number;
  }) => {
    const response = await api.get('/dao/votes', { params });
    return response.data;
  },
  
  getActiveVotes: async () => {
    const response = await api.get('/dao/votes/active');
    return response.data;
  },
  
  getVote: async (id: string) => {
    const response = await api.get(`/dao/votes/${id}`);
    return response.data;
  },
  
  submitVote: async (voteId: string, voteData: {
    option_id: string;
    signature?: string;
  }) => {
    const response = await api.post(`/dao/votes/${voteId}/vote`, voteData);
    return response.data;
  },
  
  createVote: async (voteData: {
    title: string;
    description: string;
    proposal_type: string;
    voting_options: any[];
    reference?: any;
    voting_period_hours?: number;
    quorum_required?: number;
  }) => {
    const response = await api.post('/dao/votes', voteData);
    return response.data;
  },
  
  getDashboard: async () => {
    const response = await api.get('/dao/dashboard');
    return response.data;
  },
  
  getMembers: async () => {
    const response = await api.get('/dao/members');
    return response.data;
  },
  
  assignBid: async (bidData: {
    bid_id: string;
    reason?: string;
  }) => {
    const response = await api.post('/dao/assign-bid', bidData);
    return response.data;
  },
  
  rejectBid: async (bidData: {
    bid_id: string;
    reason?: string;
  }) => {
    const response = await api.post('/dao/reject-bid', bidData);
    return response.data;
  },
  
  unassignTask: async (unassignData: {
    assignment_id: string;
    reason?: string;
  }) => {
    const response = await api.post('/dao/unassign-task', unassignData);
    return response.data;
  },
  
  getTransactions: async (params?: {
    type?: string;
    status?: string;
    page?: number;
    limit?: number;
  }) => {
    const response = await api.get('/dao/transactions', { params });
    return response.data;
  },
  
  getTransaction: async (transactionId: string) => {
    const response = await api.get(`/dao/transactions/${transactionId}`);
    return response.data;
  }
};

// Blockchain API
export const blockchainAPI = {
  updateTransaction: async (data: {
    transaction_id: string;
    tx_hash: string;
    block_number?: number;
    assignment_id?: string;
  }) => {
    const response = await api.post('/blockchain/update-transaction', data);
    return response.data;
  },
  
  markTransactionFailed: async (data: {
    transaction_id: string;
    error_message?: string;
  }) => {
    const response = await api.post('/blockchain/transaction-failed', data);
    return response.data;
  },
  
  getStatus: async () => {
    const response = await api.get('/blockchain/status');
    return response.data;
  },
  
  getBlockchainTransaction: async (txHash: string) => {
    const response = await api.get(`/blockchain/transaction/${txHash}`);
    return response.data;
  },
  
  releaseEscrow: async (assignmentId: string) => {
    const response = await api.post(`/blockchain/escrow/${assignmentId}/release`);
    return response.data;
  },
  
  disputeEscrow: async (assignmentId: string, reason?: string) => {
    const response = await api.post(`/blockchain/escrow/${assignmentId}/dispute`, { reason });
    return response.data;
  }
};

// AI API
export const aiAPI = {
  classifyGrievance: async (grievanceId: string) => {
    const response = await api.post(`/ai/classify/${grievanceId}`);
    return response.data;
  },
  
  verifyTask: async (assignmentId: string, verificationData: {
    proof_image_url: string;
    proof_description?: string;
  }) => {
    const response = await api.post(`/ai/verify-task/${assignmentId}`, verificationData);
    return response.data;
  },
  
  analyzeImage: async (imageData: {
    image_url: string;
    context?: string;
    analysis_type?: string;
  }) => {
    const response = await api.post('/ai/analyze-image', imageData);
    return response.data;
  },
  
  getStats: async () => {
    const response = await api.get('/ai/stats');
    return response.data;
  }
};

// Export the configured axios instance for custom requests
export { api };
export default api;
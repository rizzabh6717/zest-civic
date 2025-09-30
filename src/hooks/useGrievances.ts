import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';

export interface Grievance {
  id: string;
  citizen_id: string;
  title: string;
  description: string;
  category?: string;
  priority: string;
  location: string;
  image_url?: string;
  status: string;
  ai_classification?: any;
  blockchain_tx_hash?: string;
  created_at: string;
  updated_at: string;
}

export interface WorkerBid {
  id: string;
  grievance_id: string;
  worker_id: string;
  bid_amount: number;
  proposal: string;
  status: string;
  created_at: string;
}

export const useGrievances = () => {
  return useQuery({
    queryKey: ['grievances'],
    queryFn: async () => {
      const response = await axios.get(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api'}/grievances`);
      return response.data.data.grievances as Grievance[];
    }
  });
};

// Hook for marketplace grievances (available for bidding)
export const useMarketplaceGrievances = () => {
  return useQuery({
    queryKey: ['marketplace-grievances'],
    queryFn: async () => {
      const response = await axios.get(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api'}/grievances/marketplace`);
      return response.data.data.grievances as Grievance[];
    }
  });
};

export const useSubmitGrievance = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (grievanceData: {
      title: string;
      description: string;
      location: string;
      category?: string;
      image_url?: string;
    }) => {
      const token = localStorage.getItem('auth_token');
      const response = await axios.post(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api'}/grievances`,
        grievanceData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grievances'] });
    }
  });
};

export const useWorkerBids = (grievanceId?: string) => {
  return useQuery({
    queryKey: ['worker-bids', grievanceId],
    queryFn: async () => {
      let query = supabase.from('worker_bids').select('*');
      
      if (grievanceId) {
        query = query.eq('grievance_id', grievanceId);
      }
      
      const { data, error } = await query.order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as WorkerBid[];
    },
    enabled: !!grievanceId
  });
};

export const useSubmitBid = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (bidData: {
      grievance_id: string;
      bid_amount: number;
      proposal: string;
      estimated_completion_time?: number;
    }) => {
      const token = localStorage.getItem('auth_token');
      console.log('Auth token from localStorage:', token ? token.substring(0, 20) + '...' : 'No token found');
      
      if (!token) {
        throw new Error('No authentication token found. Please authenticate first.');
      }
      
      const requestData = {
        ...bidData,
        estimated_completion_time: bidData.estimated_completion_time || 24
      };
      
      console.log('Bid request data:', requestData);
      
      const response = await axios.post(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api'}/bids/simple`,
        requestData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['worker-bids'] });
      queryClient.invalidateQueries({ queryKey: ['grievances'] });
      queryClient.invalidateQueries({ queryKey: ['marketplace-grievances'] });
    }
  });
};

export const useVerifyTask = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (verificationData: {
      assignment_id: string;
      proof_image_url: string;
      citizen_approval: boolean;
    }) => {
      const { data, error } = await supabase.functions.invoke('verify-task', {
        body: verificationData
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['grievances'] });
    }
  });
};
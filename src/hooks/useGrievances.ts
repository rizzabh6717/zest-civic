import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

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
      const { data, error } = await supabase
        .from('grievances')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as Grievance[];
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
      citizen_id: string;
    }) => {
      const { data, error } = await supabase.functions.invoke('submit-grievance', {
        body: grievanceData
      });
      
      if (error) throw error;
      return data;
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
      worker_id: string;
      bid_amount: number;
      proposal: string;
    }) => {
      const { data, error } = await supabase.functions.invoke('submit-bid', {
        body: bidData
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['worker-bids'] });
      queryClient.invalidateQueries({ queryKey: ['grievances'] });
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
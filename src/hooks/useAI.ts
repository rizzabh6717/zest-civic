import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { aiAPI } from '@/services/api';

// Hook for AI classification of grievances
export const useAIClassification = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (grievanceId: string) => {
      const response = await aiAPI.classifyGrievance(grievanceId);
      return response.data;
    },
    onSuccess: (data, grievanceId) => {
      // Invalidate grievance queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['grievances'] });
      queryClient.invalidateQueries({ queryKey: ['grievance', grievanceId] });
      queryClient.invalidateQueries({ queryKey: ['ai-stats'] });
    }
  });
};

// Hook for AI task verification
export const useAIVerification = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      assignmentId, 
      proofImageUrl, 
      proofDescription 
    }: {
      assignmentId: string;
      proofImageUrl: string;
      proofDescription?: string;
    }) => {
      const response = await aiAPI.verifyTask(assignmentId, {
        proof_image_url: proofImageUrl,
        proof_description: proofDescription || ''
      });
      return response.data;
    },
    onSuccess: (data, variables) => {
      // Invalidate assignment queries
      queryClient.invalidateQueries({ queryKey: ['assignments'] });
      queryClient.invalidateQueries({ queryKey: ['assignment', variables.assignmentId] });
    }
  });
};

// Hook for AI image analysis
export const useAIImageAnalysis = () => {
  return useMutation({
    mutationFn: async ({ 
      imageUrl, 
      context, 
      analysisType 
    }: {
      imageUrl: string;
      context?: string;
      analysisType?: string;
    }) => {
      const response = await aiAPI.analyzeImage({
        image_url: imageUrl,
        context: context || '',
        analysis_type: analysisType || 'general'
      });
      return response.data;
    }
  });
};

// Hook for AI statistics
export const useAIStats = () => {
  return useQuery({
    queryKey: ['ai-stats'],
    queryFn: async () => {
      const response = await aiAPI.getStats();
      return response.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 10 * 60 * 1000, // Refetch every 10 minutes
  });
};

// Custom hook for AI confidence indicators
export const useAIConfidence = (confidence: number) => {
  const getConfidenceLevel = (confidence: number): 'low' | 'medium' | 'high' | 'very-high' => {
    if (confidence >= 0.9) return 'very-high';
    if (confidence >= 0.75) return 'high';
    if (confidence >= 0.5) return 'medium';
    return 'low';
  };

  const getConfidenceColor = (level: string): string => {
    switch (level) {
      case 'very-high': return 'text-green-600 bg-green-50';
      case 'high': return 'text-blue-600 bg-blue-50';
      case 'medium': return 'text-yellow-600 bg-yellow-50';
      case 'low': return 'text-red-600 bg-red-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getConfidenceText = (level: string): string => {
    switch (level) {
      case 'very-high': return 'Very High Confidence';
      case 'high': return 'High Confidence';
      case 'medium': return 'Medium Confidence';
      case 'low': return 'Low Confidence';
      default: return 'Unknown Confidence';
    }
  };

  const level = getConfidenceLevel(confidence);
  
  return {
    level,
    color: getConfidenceColor(level),
    text: getConfidenceText(level),
    percentage: Math.round(confidence * 100),
    shouldShowWarning: confidence < 0.6
  };
};

// Hook for batch AI operations
export const useBatchAI = () => {
  const [operations, setOperations] = useState<Array<{
    id: string;
    type: 'classify' | 'verify' | 'analyze';
    status: 'pending' | 'loading' | 'success' | 'error';
    result?: any;
    error?: string;
  }>>([]);

  const addOperation = (id: string, type: 'classify' | 'verify' | 'analyze') => {
    setOperations(prev => [...prev, { id, type, status: 'pending' }]);
  };

  const updateOperationStatus = (id: string, status: string, result?: any, error?: string) => {
    setOperations(prev => prev.map(op => 
      op.id === id ? { ...op, status: status as any, result, error } : op
    ));
  };

  const clearOperations = () => {
    setOperations([]);
  };

  const runBatchOperations = async () => {
    const pendingOps = operations.filter(op => op.status === 'pending');
    
    for (const op of pendingOps) {
      try {
        updateOperationStatus(op.id, 'loading');
        
        let result;
        switch (op.type) {
          case 'classify':
            result = await aiAPI.classifyGrievance(op.id);
            break;
          case 'verify':
            // This would need additional parameters passed in
            break;
          case 'analyze':
            // This would need additional parameters passed in
            break;
        }
        
        updateOperationStatus(op.id, 'success', result?.data);
      } catch (error: any) {
        updateOperationStatus(op.id, 'error', undefined, error.message);
      }
    }
  };

  return {
    operations,
    addOperation,
    updateOperationStatus,
    clearOperations,
    runBatchOperations,
    pendingCount: operations.filter(op => op.status === 'pending').length,
    completedCount: operations.filter(op => op.status === 'success').length,
    errorCount: operations.filter(op => op.status === 'error').length
  };
};
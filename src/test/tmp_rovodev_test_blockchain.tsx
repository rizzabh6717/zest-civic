import React from 'react';
import { useWeb3 } from '@/contexts/Web3Context';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

export function TestBlockchainSubmission() {
  const { account, contract, isConnected, isAuthenticated } = useWeb3();
  const { toast } = useToast();

  const testDirectBlockchainCall = async () => {
    try {
      console.log('=== DIRECT BLOCKCHAIN TEST ===');
      console.log('Account:', account);
      console.log('Is Connected:', isConnected);
      console.log('Is Authenticated:', isAuthenticated);
      console.log('Contract object:', contract);

      if (!contract) {
        throw new Error('Contract not initialized');
      }

      // Test contract connection
      console.log('Testing contract connection...');
      const stats = await contract.getDashboardStats();
      console.log('Contract stats:', stats);

      // Test MetaMask
      if (typeof window.ethereum === 'undefined') {
        throw new Error('MetaMask not detected');
      }

      const accounts = await window.ethereum.request({ method: 'eth_accounts' });
      console.log('MetaMask accounts:', accounts);

      // Test blockchain submission
      const testHash = `test_grievance_${Date.now()}`;
      console.log('About to submit test grievance:', testHash);

      toast({
        title: "Testing blockchain submission...",
        description: "Please confirm the transaction in MetaMask",
      });

      const txId = await contract.submitGrievance(testHash);
      console.log('Blockchain transaction successful:', txId);

      toast({
        title: "Blockchain test successful!",
        description: `Transaction ID: ${txId}`,
      });

    } catch (error) {
      console.error('Blockchain test failed:', error);
      toast({
        title: "Blockchain test failed",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  return (
    <div className="p-6 space-y-4">
      <h2 className="text-xl font-bold text-white">Blockchain Submission Test</h2>
      
      <div className="space-y-2 text-white">
        <p>Account: {account || 'Not connected'}</p>
        <p>Connected: {isConnected ? 'Yes' : 'No'}</p>
        <p>Authenticated: {isAuthenticated ? 'Yes' : 'No'}</p>
        <p>Contract Available: {contract ? 'Yes' : 'No'}</p>
      </div>

      <Button 
        onClick={testDirectBlockchainCall}
        disabled={!account || !contract}
        className="w-full"
      >
        Test Direct Blockchain Submission
      </Button>
    </div>
  );
}
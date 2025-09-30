import React, { useState, useEffect } from 'react';
import { useWeb3 } from '@/contexts/Web3Context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2 } from 'lucide-react';
import type { DashboardStats } from '@/services/contractService';

export function ContractExample() {
  const { contract, account, isConnected, userType } = useWeb3();
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Form states for different actions
  const [grievanceData, setGrievanceData] = useState('');
  const [bidData, setBidData] = useState({ grievanceId: '', amount: '' });

  // Load dashboard stats
  useEffect(() => {
    const loadStats = async () => {
      try {
        const stats = await contract.getDashboardStats();
        setDashboardStats(stats);
      } catch (err) {
        console.error('Failed to load dashboard stats:', err);
      }
    };

    loadStats();
  }, [contract]);

  // Submit grievance example
  const handleSubmitGrievance = async () => {
    if (!grievanceData.trim()) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const grievanceId = await contract.submitGrievance(grievanceData);
      alert(`Grievance submitted successfully! ID: ${grievanceId}`);
      setGrievanceData('');
      
      // Refresh stats
      const stats = await contract.getDashboardStats();
      setDashboardStats(stats);
    } catch (err: any) {
      setError(err.message || 'Failed to submit grievance');
    } finally {
      setLoading(false);
    }
  };

  // Submit bid example
  const handleSubmitBid = async () => {
    if (!bidData.grievanceId || !bidData.amount) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const bidId = await contract.submitBid(
        parseInt(bidData.grievanceId),
        parseFloat(bidData.amount)
      );
      alert(`Bid submitted successfully! ID: ${bidId}`);
      setBidData({ grievanceId: '', amount: '' });
    } catch (err: any) {
      setError(err.message || 'Failed to submit bid');
    } finally {
      setLoading(false);
    }
  };

  if (!isConnected) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Contract Integration</CardTitle>
          <CardDescription>Connect your wallet to interact with the contract</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Contract Dashboard</CardTitle>
          <CardDescription>
            Connected to: {account} | User Type: {userType}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {dashboardStats && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="bg-blue-50 p-3 rounded">
                <div className="text-2xl font-bold text-blue-600">{dashboardStats.totalGrievances}</div>
                <div className="text-sm text-blue-800">Total Grievances</div>
              </div>
              <div className="bg-green-50 p-3 rounded">
                <div className="text-2xl font-bold text-green-600">{dashboardStats.openGrievances}</div>
                <div className="text-sm text-green-800">Open Grievances</div>
              </div>
              <div className="bg-purple-50 p-3 rounded">
                <div className="text-2xl font-bold text-purple-600">{dashboardStats.totalBids}</div>
                <div className="text-sm text-purple-800">Total Bids</div>
              </div>
              <div className="bg-orange-50 p-3 rounded">
                <div className="text-2xl font-bold text-orange-600">{dashboardStats.assignedTasks}</div>
                <div className="text-sm text-orange-800">Assigned Tasks</div>
              </div>
              <div className="bg-indigo-50 p-3 rounded">
                <div className="text-2xl font-bold text-indigo-600">{dashboardStats.completedTasks}</div>
                <div className="text-sm text-indigo-800">Completed Tasks</div>
              </div>
              <div className="bg-gray-50 p-3 rounded">
                <div className="text-2xl font-bold text-gray-600">{dashboardStats.resolvedGrievances}</div>
                <div className="text-sm text-gray-800">Resolved</div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Citizen Actions */}
      {userType === 'citizen' && (
        <Card>
          <CardHeader>
            <CardTitle>Submit Grievance</CardTitle>
            <CardDescription>Submit a new grievance to the platform</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="grievance-data">Grievance Data Hash</Label>
              <Input
                id="grievance-data"
                value={grievanceData}
                onChange={(e) => setGrievanceData(e.target.value)}
                placeholder="Enter data hash (e.g., QmXxx...)"
              />
            </div>
            <Button 
              onClick={handleSubmitGrievance} 
              disabled={loading || !grievanceData.trim()}
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Submit Grievance
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Worker Actions */}
      {userType === 'worker' && (
        <Card>
          <CardHeader>
            <CardTitle>Submit Bid</CardTitle>
            <CardDescription>Bid on an open grievance</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="grievance-id">Grievance ID</Label>
              <Input
                id="grievance-id"
                type="number"
                value={bidData.grievanceId}
                onChange={(e) => setBidData(prev => ({ ...prev, grievanceId: e.target.value }))}
                placeholder="Enter grievance ID"
              />
            </div>
            <div>
              <Label htmlFor="bid-amount">Bid Amount (INR)</Label>
              <Input
                id="bid-amount"
                type="number"
                step="0.01"
                value={bidData.amount}
                onChange={(e) => setBidData(prev => ({ ...prev, amount: e.target.value }))}
                placeholder="Enter bid amount in INR"
              />
            </div>
            <Button 
              onClick={handleSubmitBid} 
              disabled={loading || !bidData.grievanceId || !bidData.amount}
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Submit Bid
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Contract Info */}
      <Card>
        <CardHeader>
          <CardTitle>Contract Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div><strong>Contract Address:</strong> 0x26600f2341f30bb9829bc2fcaa48ae8c0d74736e</div>
            <div><strong>Network:</strong> Testnet</div>
            <div><strong>Your Address:</strong> {account}</div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
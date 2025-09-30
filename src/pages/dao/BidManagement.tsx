import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  User, 
  DollarSign, 
  Calendar,
  MapPin,
  Star,
  Filter,
  Search
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { daoAPI, bidsAPI, blockchainAPI } from '@/services/api';
import { useWeb3 } from '@/contexts/Web3Context';

interface Bid {
  _id: string;
  grievance_id: string;
  worker_id: string;
  bid_amount: number;
  proposal: string;
  estimated_completion_time: number;
  skills_offered: string[];
  status: 'pending' | 'accepted' | 'rejected' | 'withdrawn';
  worker_reputation: number;
  createdAt: string;
  grievance?: {
    _id: string;
    title: string;
    category: string;
    priority: 'low' | 'medium' | 'high' | 'urgent';
    location: string;
    status: string;
  };
  worker?: {
    display_name: string;
    reputation: {
      score: number;
    };
    profile?: {
      skills: Array<{ name: string; level: string }>;
    };
  };
}

const BidManagement: React.FC = () => {
  const [bids, setBids] = useState<Bid[]>([]);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('newest');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [lastTransaction, setLastTransaction] = useState<any>(null);
  const { toast } = useToast();
  const { contract, account } = useWeb3();

  useEffect(() => {
    fetchBids();
  }, [currentPage, statusFilter, sortBy]);

  const fetchBids = async () => {
    try {
      setLoading(true);
      const params: any = {
        page: currentPage,
        limit: 20,
        sort: getSortValue(sortBy)
      };

      if (statusFilter !== 'all') {
        params.status = statusFilter;
      }

      // Use full backend URL for bids
      const response = await fetch(`http://localhost:5000/api/bids?${new URLSearchParams(params)}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch bids: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.success) {
        setBids(data.data.bids);
        setTotalPages(data.data.pagination.total_pages);
      }
    } catch (error) {
      console.error('Error fetching bids:', error);
      toast({
        title: "Error",
        description: "Failed to fetch bids",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const getSortValue = (sort: string): string => {
    switch (sort) {
      case 'newest': return '-createdAt';
      case 'oldest': return 'createdAt';
      case 'amount_low': return 'bid_amount';
      case 'amount_high': return '-bid_amount';
      case 'reputation': return '-worker_reputation';
      default: return '-createdAt';
    }
  };

  const assignWork = async (bidId: string, grievanceId: string) => {
    try {
      console.log('🚀 ===== ASSIGNMENT PROCESS STARTED =====');
      console.log('📋 Input Parameters:', { bidId, grievanceId });
      console.log('👤 Current Account:', account);
      console.log('🔗 Contract Available:', !!contract);
      console.log('🌐 Window Ethereum:', !!window.ethereum);
      
      setAssigning(bidId);
      
      // Step 1: Assign work in database first
      console.log('\n📊 ===== STEP 1: DATABASE ASSIGNMENT =====');
      console.log('📤 Calling backend API with:', {
        bid_id: bidId,
        reason: 'DAO manual assignment'
      });
      
      const response = await daoAPI.assignBid({
        bid_id: bidId,
        reason: 'DAO manual assignment'
      });

      console.log('📥 Backend Response:', JSON.stringify(response, null, 2));

      if (response.success) {
        // Store transaction information
        setLastTransaction(response.data.transaction);
        
        // Step 2: Trigger blockchain transaction via MetaMask
        console.log('\n⛓️ ===== STEP 2: BLOCKCHAIN TRANSACTION =====');
        
        try {
          console.log('🔍 Pre-flight Checks:');
          console.log('  - Contract available:', !!contract);
          console.log('  - Contract type:', typeof contract);
          console.log('  - Account connected:', account);
          console.log('  - Window.ethereum available:', !!window.ethereum);
          console.log('  - MetaMask selectedAddress:', window.ethereum?.selectedAddress);
          
          // Ensure wallet is connected first
          if (!account && !window.ethereum?.selectedAddress) {
            console.log('🔗 No wallet detected, requesting connection...');
            toast({
              title: "Connecting Wallet",
              description: "Please connect your wallet to complete the blockchain transaction.",
            });
            
            // Request wallet connection
            if (typeof window.ethereum !== 'undefined') {
              try {
                console.log('📞 Requesting wallet accounts...');
                const accounts = await window.ethereum.request({
                  method: 'eth_requestAccounts',
                });
                console.log('✅ Wallet connection successful:', accounts);
                console.log('✅ Primary account:', accounts[0]);
                
                // Also get network info
                const chainId = await window.ethereum.request({ method: 'eth_chainId' });
                console.log('🌐 Current chain ID:', chainId);
                console.log('🌐 Expected chain ID: 43113 (Avalanche Fuji)');
                
              } catch (connectionError) {
                console.error('❌ Wallet connection error:', connectionError);
                toast({
                  title: "Wallet Connection Failed",
                  description: `Connection error: ${connectionError.message}`,
                  variant: "destructive"
                });
                return;
              }
            } else {
              console.error('❌ MetaMask not found');
              toast({
                title: "MetaMask Not Found", 
                description: "Please install MetaMask to complete blockchain transactions.",
                variant: "destructive"
              });
              return;
            }
          }
          
          const currentAccount = account || window.ethereum?.selectedAddress;
          
          if (contract && currentAccount) {
            console.log('🔗 ===== CONTRACT INTERACTION =====');
            console.log('📋 Transaction Details:');
            console.log('  - Contract address:', contract.address || 'N/A');
            console.log('  - Current account:', currentAccount);
            console.log('  - Escrow amount (INR):', response.data.escrow_amount);
            console.log('  - Grievance ID:', grievanceId);
            console.log('  - Bid ID:', bidId);
            
            try {
              // Convert INR amount to AVAX for escrow
              const escrowAmountINR = response.data.escrow_amount;
              console.log('\n💱 ===== CURRENCY CONVERSION =====');
              console.log('📤 Converting INR to AVAX...');
              console.log('💰 Input amount (INR):', escrowAmountINR);
              
              const avaxAmountResult = await contract.convertINRToAVAX(escrowAmountINR);
              console.log('✅ Conversion successful');
              console.log('💰 Raw conversion result:', avaxAmountResult);
              
              // Extract the actual BigNumber value from the result
              const avaxAmount = avaxAmountResult.value || avaxAmountResult;
              console.log('💰 Extracted AVAX amount:', avaxAmount?.toString());
              
              // Skip role check since contract doesn't have hasRole function
              console.log('\n🔐 ===== PERMISSION CHECK =====');
              console.log('📤 Skipping contract role check (using database permissions)');
              console.log('✅ Database DAO role verified, proceeding with transaction');
              console.log('👤 Transaction will be from account:', currentAccount);
              
              console.log('\n🚀 ===== TRANSACTION EXECUTION =====');
              console.log('📋 Final Parameters:');
              console.log('  - Grievance ID:', parseInt(grievanceId));
              console.log('  - Bid ID:', parseInt(bidId));
              console.log('  - Transaction value (AVAX):', avaxAmount?.toString());
              
              toast({
                title: "MetaMask Transaction Required",
                description: "Please approve the blockchain transaction in MetaMask to complete the assignment.",
              });

              console.log('📤 Calling contract.assignTask...');
              console.log('⏳ Waiting for user confirmation in MetaMask...');
              
              toast({
                title: "MetaMask Popup Coming",
                description: "Please approve the transaction in MetaMask to complete the assignment.",
              });
              
              // This will trigger MetaMask popup - correct function signature (grievanceId, bidId)
              console.log('📤 Transaction options:', { value: avaxAmount });
              console.log('📤 AVAX amount type:', typeof avaxAmount);
              console.log('📤 AVAX amount value:', avaxAmount?.toString());
              
              const txResult = await contract.assignTask(
                parseInt(grievanceId), 
                parseInt(bidId),
                { value: avaxAmount } // Send AVAX as transaction value (now properly extracted)
              );
              
              console.log('🎉 ===== TRANSACTION SUCCESS =====');
              console.log('✅ Transaction submitted to blockchain');
              console.log('📄 Transaction result:', JSON.stringify(txResult, null, 2));
              console.log('🔗 Transaction hash:', txResult.hash || txResult.transactionHash);
              
            } catch (contractError) {
              console.error('💥 ===== CONTRACT ERROR =====');
              console.error('❌ Contract interaction failed:', contractError);
              console.error('📄 Error details:', {
                name: contractError.name,
                message: contractError.message,
                code: contractError.code,
                data: contractError.data
              });
              
              throw contractError; // Re-throw to be caught by outer catch
            }
            
            // Update backend with blockchain transaction details
            if (txResult && response.data.transaction.transaction_id) {
              try {
                await blockchainAPI.updateTransaction({
                  transaction_id: response.data.transaction.transaction_id,
                  tx_hash: txResult.transactionHash || txResult.hash,
                  block_number: txResult.blockNumber,
                  assignment_id: response.data.assignment_id
                });
                
                console.log('✅ Backend updated with blockchain transaction details');
              } catch (updateError) {
                console.warn('Failed to update backend with blockchain details:', updateError);
              }
            }
            
            toast({
              title: "Blockchain Transaction Completed! ✅",
              description: `Work assignment recorded on blockchain. TX: ${(txResult.transactionHash || txResult.hash)?.slice(0, 10)}...`,
            });
          } else {
            console.log('❌ Contract not available:', { 
              hasContract: !!contract,
              contractType: typeof contract 
            });
            
            toast({
              title: "Contract Not Available",
              description: "Blockchain contract not initialized. Assignment completed in database only.",
              variant: "destructive"
            });
          }
        } catch (blockchainError: any) {
          console.error('\n💥 ===== BLOCKCHAIN TRANSACTION FAILED =====');
          console.error('❌ Error type:', blockchainError.constructor.name);
          console.error('❌ Error message:', blockchainError.message);
          console.error('❌ Error code:', blockchainError.code);
          console.error('❌ Full error:', blockchainError);
          
          // Parse common error types
          let userFriendlyMessage = "Unknown blockchain error";
          if (blockchainError.message?.includes('user rejected')) {
            userFriendlyMessage = "Transaction was cancelled by user";
          } else if (blockchainError.message?.includes('insufficient funds')) {
            userFriendlyMessage = "Insufficient funds for gas fees";
          } else if (blockchainError.message?.includes('execution reverted')) {
            userFriendlyMessage = "Contract execution failed - check permissions and parameters";
          } else if (blockchainError.code === 4001) {
            userFriendlyMessage = "Transaction rejected by user in MetaMask";
          }
          
          console.error('👤 User-friendly message:', userFriendlyMessage);
          
          // Notify backend that blockchain transaction failed
          if (response.data.transaction.transaction_id) {
            try {
              console.log('📤 Notifying backend of failure...');
              await blockchainAPI.markTransactionFailed({
                transaction_id: response.data.transaction.transaction_id,
                error_message: `${blockchainError.message || 'MetaMask transaction failed'} (Code: ${blockchainError.code || 'N/A'})`
              });
              console.log('✅ Backend notified of failure');
            } catch (updateError) {
              console.error('❌ Failed to update backend:', updateError);
            }
          }
          
          toast({
            title: "Blockchain Transaction Failed",
            description: `${userFriendlyMessage}. Work was assigned in database successfully.`,
            variant: "destructive"
          });
        }
        
        toast({
          title: "Work Assigned Successfully! 🎉",
          description: (
            <div className="space-y-2">
              <p>Task assigned to worker successfully!</p>
              <div className="text-xs bg-white/10 p-2 rounded mt-2">
                <p><strong>Transaction ID:</strong> {response.data.transaction.transaction_id}</p>
                <p><strong>Amount:</strong> {response.data.transaction.amount}</p>
                <p><strong>Status:</strong> {response.data.transaction.status}</p>
                <p><strong>Worker:</strong> {response.data.worker_id.slice(-6)}</p>
              </div>
            </div>
          ),
        });
        
        // Refresh bids list
        fetchBids();
      }
    } catch (error: any) {
      console.error('Error assigning work:', error);
      toast({
        title: "Assignment Failed",
        description: error.response?.data?.message || "Failed to assign work",
        variant: "destructive"
      });
    } finally {
      setAssigning(null);
    }
  };

  const rejectBid = async (bidId: string) => {
    try {
      const response = await daoAPI.rejectBid({
        bid_id: bidId,
        reason: 'Rejected by DAO review'
      });

      if (response.success) {
        toast({
          title: "Bid Rejected",
          description: "Bid has been rejected successfully",
        });
        fetchBids();
      }
    } catch (error: any) {
      console.error('Error rejecting bid:', error);
      toast({
        title: "Error",
        description: error.response?.data?.message || "Failed to reject bid",
        variant: "destructive"
      });
    }
  };


  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      pending: { variant: "secondary", icon: Clock },
      accepted: { variant: "default", icon: CheckCircle },
      rejected: { variant: "destructive", icon: XCircle },
      withdrawn: { variant: "outline", icon: XCircle }
    };
    
    const config = variants[status] || variants.pending;
    const Icon = config.icon;
    
    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className="w-3 h-3" />
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const getPriorityBadge = (priority: string) => {
    const variants: Record<string, string> = {
      low: "outline",
      medium: "secondary", 
      high: "default",
      urgent: "destructive"
    };
    
    return (
      <Badge variant={variants[priority] as any}>
        {priority.charAt(0).toUpperCase() + priority.slice(1)}
      </Badge>
    );
  };

  const filteredBids = bids.filter(bid => {
    const matchesSearch = searchTerm === '' || 
      bid.grievance?.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      bid.worker?.display_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      bid.proposal.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesPriority = priorityFilter === 'all' || 
      bid.grievance?.priority === priorityFilter;
    
    return matchesSearch && matchesPriority;
  });

  const groupedBids = filteredBids.reduce((acc, bid) => {
    const key = bid.grievance_id;
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(bid);
    return acc;
  }, {} as Record<string, Bid[]>);

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-white">Bid Management</h1>
          <div className="text-sm text-white/70">
            Total Bids: {bids.length}
          </div>
        </div>

        {/* Latest Transaction Alert */}
        {lastTransaction && (
          <Alert className="bg-green-500/10 border-green-500/20">
            <CheckCircle className="h-4 w-4 text-green-400" />
            <AlertDescription className="text-white/80">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-medium">Latest Assignment Transaction</p>
                  <p className="text-sm text-white/60">
                    ID: {lastTransaction.transaction_id} | Amount: {lastTransaction.amount} | 
                    Status: <span className="text-green-400">{lastTransaction.status}</span>
                  </p>
                </div>
                <Button 
                  size="sm" 
                  variant="ghost" 
                  onClick={() => setLastTransaction(null)}
                  className="text-white/60 hover:text-white"
                >
                  ×
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Filters */}
        <Card className="bg-white/5 border-white/10">
          <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-white/50" />
              <Input
                placeholder="Search bids..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-white/10 border-white/20 text-white placeholder:text-white/50"
              />
            </div>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="accepted">Accepted</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="withdrawn">Withdrawn</SelectItem>
              </SelectContent>
            </Select>

            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priorities</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>

            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger>
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest First</SelectItem>
                <SelectItem value="oldest">Oldest First</SelectItem>
                <SelectItem value="amount_low">Lowest Bid</SelectItem>
                <SelectItem value="amount_high">Highest Bid</SelectItem>
                <SelectItem value="reputation">Best Reputation</SelectItem>
              </SelectContent>
            </Select>
          </div>
          </CardContent>
        </Card>

        {/* Bids Display */}
        <Tabs defaultValue="grouped" className="space-y-4">
          <TabsList className="bg-white/10 border-white/20">
            <TabsTrigger value="grouped" className="data-[state=active]:bg-white/20 data-[state=active]:text-white text-white/70">Grouped by Task</TabsTrigger>
            <TabsTrigger value="list" className="data-[state=active]:bg-white/20 data-[state=active]:text-white text-white/70">All Bids</TabsTrigger>
          </TabsList>

          <TabsContent value="grouped" className="space-y-4">
            {Object.entries(groupedBids).map(([grievanceId, grievanceBids]) => {
              const grievance = grievanceBids[0]?.grievance;
              return (
                <Card key={grievanceId} className="bg-white/5 border-white/10">
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-lg text-white">{grievance?.title}</CardTitle>
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant="outline" className="border-white/20 text-white/80">{grievance?.category}</Badge>
                          {grievance && getPriorityBadge(grievance.priority)}
                          <div className="flex items-center gap-1 text-sm text-white/60">
                            <MapPin className="w-3 h-3" />
                            {grievance?.location}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-white/60">
                          {grievanceBids.length} bid{grievanceBids.length !== 1 ? 's' : ''}
                        </div>
                        <div className="text-xs text-white/60">
                          Status: {grievance?.status}
                        </div>
                      </div>
                    </div>
                </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {grievanceBids.map((bid) => (
                        <div key={bid._id} className="border border-white/10 rounded-lg p-4 bg-white/5">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <div className="flex items-center gap-2">
                                <User className="w-4 h-4 text-white/70" />
                                <span className="font-medium text-white">
                                  {bid.worker?.display_name || `Worker ${bid.worker_id.slice(-6)}`}
                                </span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Star className="w-4 h-4 text-yellow-500" />
                                <span className="text-sm text-white/80">
                                  {bid.worker?.reputation?.score || 0}/100
                                </span>
                              </div>
                              {getStatusBadge(bid.status)}
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
                              <div className="flex items-center gap-2">
                                <DollarSign className="w-4 h-4 text-green-400" />
                                <span className="font-semibold text-white">${bid.bid_amount}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-blue-400" />
                                <span className="text-white/80">{bid.estimated_completion_time}h</span>
                              </div>
                              <div className="text-sm text-white/60">
                                {new Date(bid.createdAt).toLocaleDateString()}
                              </div>
                            </div>
                            
                            <p className="text-sm text-white/70 mb-2">
                              {bid.proposal}
                            </p>
                            
                            {bid.skills_offered.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {bid.skills_offered.map((skill, index) => (
                                  <Badge key={index} variant="secondary" className="text-xs bg-white/10 text-white/80 border-white/20">
                                    {skill}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                          
                          {bid.status === 'pending' && (
                            <div className="flex gap-2 ml-4">
                              <Button
                                size="sm"
                                onClick={() => assignWork(bid._id, bid.grievance_id)}
                                disabled={assigning === bid._id}
                                className="bg-green-600 hover:bg-green-700 text-white"
                              >
                                {assigning === bid._id ? 'Assigning...' : 'Assign Work'}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => rejectBid(bid._id)}
                                className="text-red-400 border-red-400 hover:bg-red-400/10"
                              >
                                Reject
                              </Button>
                            </div>
                          )}
                          
                          {bid.status === 'accepted' && (
                            <div className="flex gap-2 ml-4">
                              <Badge variant="default" className="bg-green-600 text-white">
                                ✅ Assigned
                              </Badge>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

          <TabsContent value="list" className="space-y-4">
            {filteredBids.map((bid) => (
              <Card key={bid._id} className="bg-white/5 border-white/10">
                <CardContent className="pt-6">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-white">{bid.grievance?.title}</h3>
                      {getStatusBadge(bid.status)}
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-3">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-white/70" />
                        <span className="text-white/80">{bid.worker?.display_name || `Worker ${bid.worker_id.slice(-6)}`}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-green-400" />
                        <span className="font-semibold text-white">${bid.bid_amount}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-blue-400" />
                        <span className="text-white/80">{bid.estimated_completion_time}h</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Star className="w-4 h-4 text-yellow-500" />
                        <span className="text-white/80">{bid.worker?.reputation?.score || 0}/100</span>
                      </div>
                    </div>
                    
                    <p className="text-sm text-white/70">{bid.proposal}</p>
                  </div>
                  
                  {bid.status === 'pending' && (
                    <div className="flex gap-2 ml-4">
                      <Button
                        size="sm"
                        onClick={() => assignWork(bid._id, bid.grievance_id)}
                        disabled={assigning === bid._id}
                        className="bg-green-600 hover:bg-green-700 text-white"
                      >
                        {assigning === bid._id ? 'Assigning...' : 'Assign Work'}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => rejectBid(bid._id)}
                        className="text-red-400 border-red-400 hover:bg-red-400/10"
                      >
                        Reject
                      </Button>
                    </div>
                  )}
                  
                  {bid.status === 'accepted' && (
                    <div className="flex gap-2 ml-4">
                      <Badge variant="default" className="bg-green-600 text-white">
                        ✅ Assigned
                      </Badge>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-center gap-2">
            <Button
              variant="outline"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(currentPage - 1)}
              className="border-white/20 text-white hover:bg-white/10"
            >
              Previous
            </Button>
            <span className="flex items-center px-4 text-white">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="outline"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(currentPage + 1)}
              className="border-white/20 text-white hover:bg-white/10"
            >
              Next
            </Button>
          </div>
        )}

        {loading && (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white/50"></div>
          </div>
        )}

        {!loading && filteredBids.length === 0 && (
          <Card className="bg-white/5 border-white/10">
            <CardContent className="pt-6">
              <div className="text-center py-8">
                <p className="text-white/60">No bids found matching your criteria.</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default BidManagement;
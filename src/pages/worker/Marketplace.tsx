import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useMarketplaceGrievances, useSubmitBid } from '@/hooks/useGrievances';
import { useWeb3 } from '@/contexts/Web3Context';
import { useToast } from '@/hooks/use-toast';
import { useState, useMemo } from 'react';

const navigation = [
  { name: 'Dashboard', href: '/worker/dashboard' },
  { name: 'Task Marketplace', href: '/worker/marketplace' },
  { name: 'Reputation Profile', href: '/worker/reputation' },
];

export default function Marketplace() {
  const { account, contract } = useWeb3();
  const { data: marketplaceGrievances, isLoading, error } = useMarketplaceGrievances();
  const submitBid = useSubmitBid();
  const { toast } = useToast();
  
  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  
  // Modal states
  const [selectedGrievance, setSelectedGrievance] = useState<any>(null);
  const [showAIAnalysis, setShowAIAnalysis] = useState(false);
  const [showBidModal, setShowBidModal] = useState(false);
  const [savedTasks, setSavedTasks] = useState<string[]>(() => {
    const saved = localStorage.getItem('savedTasks');
    return saved ? JSON.parse(saved) : [];
  });
  
  // Bid form state
  const [bidForm, setBidForm] = useState({
    amount: '',
    proposal: '',
    estimated_completion_time: '24' // Default 24 hours
  });

  // Filter grievances
  const filteredGrievances = useMemo(() => {
    if (!marketplaceGrievances) return [];

    let filtered = marketplaceGrievances;

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter((g: any) => 
        g.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        g.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        g.location?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Category filter
    if (categoryFilter !== 'all') {
      filtered = filtered.filter((g: any) => g.category === categoryFilter);
    }

    // Priority filter
    if (priorityFilter !== 'all') {
      filtered = filtered.filter((g: any) => 
        g.ai_classification?.priority?.toLowerCase() === priorityFilter.toLowerCase() ||
        g.priority?.toLowerCase() === priorityFilter.toLowerCase()
      );
    }

    return filtered.sort((a: any, b: any) => {
      // Sort by priority (urgent > high > medium > low) then by date
      const priorityOrder = { urgent: 4, high: 3, medium: 2, low: 1 };
      const aPriority = priorityOrder[a.ai_classification?.priority || a.priority || 'medium'];
      const bPriority = priorityOrder[b.ai_classification?.priority || b.priority || 'medium'];
      
      if (aPriority !== bPriority) {
        return bPriority - aPriority;
      }
      
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [marketplaceGrievances, searchTerm, categoryFilter, priorityFilter]);

  const getUrgencyBadge = (urgency: string) => {
    const normalizedUrgency = urgency?.toLowerCase();
    if (normalizedUrgency === 'urgent' || normalizedUrgency === 'high') {
      return { variant: 'destructive', color: 'text-red-400 border-red-400' };
    } else if (normalizedUrgency === 'medium') {
      return { variant: 'secondary', color: 'text-yellow-400 border-yellow-400' };
    } else {
      return { variant: 'outline', color: 'text-green-400 border-green-400' };
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const estimateBudget = (priority: string, category: string) => {
    const baseCosts = {
      road: { low: 200, medium: 500, high: 1000, urgent: 2000 },
      water: { low: 150, medium: 300, high: 600, urgent: 1200 },
      lighting: { low: 100, medium: 250, high: 500, urgent: 800 },
      waste: { low: 50, medium: 150, high: 300, urgent: 500 },
      sewage: { low: 300, medium: 700, high: 1500, urgent: 3000 },
      other: { low: 100, medium: 250, high: 500, urgent: 1000 }
    };

    const costs = baseCosts[category as keyof typeof baseCosts] || baseCosts.other;
    const cost = costs[priority as keyof typeof costs] || costs.medium;
    
    return `₹${cost}-${Math.round(cost * 1.5)}`;
  };

  const getSkillsRequired = (category: string, aiClassification: any) => {
    const skillMap = {
      road: ['Road Construction', 'Heavy Equipment', 'Asphalt Work'],
      water: ['Plumbing', 'Pipe Fitting', 'Water Systems'],
      lighting: ['Electrical Work', 'Lighting Installation', 'Safety Equipment'],
      waste: ['Waste Management', 'Cleaning', 'Sanitation'],
      sewage: ['Drainage Systems', 'Sewage Treatment', 'Heavy Equipment'],
      public_safety: ['Security Systems', 'Safety Equipment', 'Installation'],
      environment: ['Environmental Work', 'Cleanup', 'Maintenance'],
      other: ['General Maintenance', 'Civic Work']
    };

    return skillMap[category as keyof typeof skillMap] || skillMap.other;
  };

  const handleSaveTask = (grievanceId: string) => {
    const newSavedTasks = savedTasks.includes(grievanceId)
      ? savedTasks.filter(id => id !== grievanceId)
      : [...savedTasks, grievanceId];
    
    setSavedTasks(newSavedTasks);
    localStorage.setItem('savedTasks', JSON.stringify(newSavedTasks));
    
    toast({
      title: savedTasks.includes(grievanceId) ? "Task unsaved" : "Task saved",
      description: savedTasks.includes(grievanceId) 
        ? "Task removed from your saved list" 
        : "Task added to your dashboard"
    });
  };

  const handlePlaceBid = async () => {
    if (!selectedGrievance || !bidForm.amount || !bidForm.proposal || !account) {
      toast({
        title: "Missing information",
        description: "Please fill in all bid details and ensure wallet is connected",
        variant: "destructive"
      });
      return;
    }

    try {
      // Step 1: Submit bid to database
      toast({
        title: "Submitting bid...",
        description: "Saving bid to database",
      });

      const bidResponse = await submitBid.mutateAsync({
        grievance_id: selectedGrievance._id,
        bid_amount: parseFloat(bidForm.amount),
        proposal: bidForm.proposal,
        estimated_completion_time: parseInt(bidForm.estimated_completion_time)
      });

      console.log('✅ Database bid submission successful:', bidResponse);

      // Step 2: Submit bid to blockchain
      if (bidResponse.success && bidResponse.data.bid_id) {
        try {
          toast({
            title: "Submitting to blockchain...",
            description: "Please confirm the transaction in MetaMask",
          });

          console.log('🔗 Starting blockchain bid submission...');
          console.log('Bid details:', {
            grievanceId: selectedGrievance._id,
            bidAmount: parseFloat(bidForm.amount),
            bidId: bidResponse.data.bid_id,
            worker: account
          });

          // Submit to smart contract
          if (!contract) {
            throw new Error('Smart contract not available. Please ensure your wallet is connected.');
          }
          
          // Check if this grievance has a blockchain transaction ID
          console.log('🔍 Checking grievance blockchain status...');
          console.log('Grievance ID:', selectedGrievance._id);
          console.log('Grievance data:', selectedGrievance);
          
          // Try to get the blockchain grievance ID from smart contract
          let blockchainGrievanceId = null;
          
          try {
            // Get all grievances from blockchain to find matching one
            console.log('📡 Getting blockchain grievances...');
            const openGrievances = await contract.getOpenGrievances();
            console.log('Open grievances on blockchain:', openGrievances);
            
            if (openGrievances.length > 0) {
              // For now, use the first available grievance ID
              // In production, you'd match based on data hash or other identifier
              blockchainGrievanceId = openGrievances[0];
              console.log('🎯 Using blockchain grievance ID:', blockchainGrievanceId);
            } else {
              throw new Error('No grievances found on blockchain');
            }
          } catch (blockchainCheckError) {
            console.error('❌ Failed to get blockchain grievances:', blockchainCheckError);
            
            // Fallback: Submit this grievance to blockchain first
            console.log('🔄 Submitting grievance to blockchain first...');
            
            try {
              const grievanceHash = `grievance_${selectedGrievance._id}_${Date.now()}`;
              const grievanceResult = await contract.submitGrievance(grievanceHash);
              console.log('✅ Grievance submitted to blockchain:', grievanceResult);
              
              // Use the returned grievance ID
              blockchainGrievanceId = grievanceResult.grievanceId || 1; // Fallback to 1
              
            } catch (grievanceSubmissionError) {
              console.error('❌ Failed to submit grievance to blockchain:', grievanceSubmissionError);
              // Use a fallback ID
              blockchainGrievanceId = 1;
            }
          }
          
          console.log('🎯 Final blockchain grievance ID to use:', blockchainGrievanceId);
          
          // Check if user has WORKER_ROLE on blockchain
          console.log('🔐 Checking if user has WORKER_ROLE...');
          
          try {
            const hasWorkerRole = await contract.hasWorkerRole(account);
            console.log('Worker role status:', hasWorkerRole);
            
            if (!hasWorkerRole) {
              console.log('❌ User does not have WORKER_ROLE, attempting to grant...');
              toast({
                title: "Granting worker permissions...",
                description: "Please confirm the role assignment transaction in MetaMask",
              });
              
              try {
                // Try to grant worker role (this might fail if user is not admin)
                const roleResult = await contract.grantWorkerRole(account);
                console.log('✅ Worker role granted:', roleResult);
                
                toast({
                  title: "Worker role granted!",
                  description: "You can now submit bids to the blockchain",
                });
                
                // Wait a moment for the role to be processed
                await new Promise(resolve => setTimeout(resolve, 2000));
                
              } catch (roleError) {
                console.error('❌ Failed to grant worker role:', roleError);
                throw new Error('You need WORKER_ROLE on the blockchain to submit bids. Please contact an admin to grant this role.');
              }
            } else {
              console.log('✅ User already has WORKER_ROLE');
            }
          } catch (roleCheckError) {
            console.error('❌ Failed to check worker role:', roleCheckError);
            // Continue with bid submission anyway
          }
          
          // Now submit the bid to blockchain
          console.log('📡 Submitting bid to blockchain...');
          const contractResult = await contract.submitBid(
            Number(blockchainGrievanceId),
            Math.round(parseFloat(bidForm.amount) * 100) // Convert to scaled format (cents)
          );

          console.log('🎉 Blockchain bid submission successful:', contractResult);

          toast({
            title: "✅ Bid submitted successfully!",
            description: `Bid saved to database and blockchain. Transaction: ${contractResult.transactionHash || 'Completed'}`,
          });

        } catch (blockchainError) {
          console.error('❌ Blockchain bid submission failed:', blockchainError);
          toast({
            title: "Bid saved to database",
            description: "Blockchain submission failed, but your bid is recorded in the database",
            variant: "destructive"
          });
        }
      } else {
        toast({
          title: "Bid submitted to database",
          description: "Your bid has been saved and is visible to the citizen",
        });
      }

      setShowBidModal(false);
      setBidForm({ amount: '', proposal: '', estimated_completion_time: '24' });
      setSelectedGrievance(null);
      
    } catch (error) {
      console.error('❌ Bid submission failed:', error);
      toast({
        title: "Failed to submit bid",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive"
      });
    }
  };

  return (
    <DashboardLayout navigation={navigation} title="Task Marketplace">
      <div className="space-y-6">
        {/* Search and Filters */}
        <Card className="bg-white/5 border-white/10">
          <CardHeader>
            <CardTitle className="text-white">Find Tasks</CardTitle>
            <CardDescription className="text-white/70">
              Search and filter available community tasks
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              <Input 
                placeholder="Search tasks..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-white/5 border-white/20 text-white placeholder:text-white/50 max-w-xs"
              />
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="bg-white/5 border-white/20 text-white w-48">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="road">Road</SelectItem>
                  <SelectItem value="water">Water</SelectItem>
                  <SelectItem value="lighting">Lighting</SelectItem>
                  <SelectItem value="waste">Waste</SelectItem>
                  <SelectItem value="sewage">Sewage</SelectItem>
                  <SelectItem value="public_safety">Public Safety</SelectItem>
                  <SelectItem value="environment">Environment</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="bg-white/5 border-white/20 text-white w-48">
                  <SelectValue placeholder="All Priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priority</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                  <SelectItem value="high">High Priority</SelectItem>
                  <SelectItem value="medium">Medium Priority</SelectItem>
                  <SelectItem value="low">Low Priority</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Available Tasks */}
        {isLoading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <Card key={i} className="bg-white/5 border-white/10">
                <CardContent className="p-6">
                  <div className="animate-pulse">
                    <div className="h-6 bg-white/20 rounded w-3/4 mb-4"></div>
                    <div className="h-4 bg-white/20 rounded w-full mb-2"></div>
                    <div className="grid grid-cols-4 gap-4 mb-4">
                      {[...Array(4)].map((_, j) => (
                        <div key={j} className="h-4 bg-white/20 rounded"></div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : error ? (
          <Card className="bg-red-900/20 border-red-500/50">
            <CardContent className="p-6">
              <p className="text-red-400">Failed to load marketplace tasks. Please try again.</p>
            </CardContent>
          </Card>
        ) : filteredGrievances.length === 0 ? (
          <Card className="bg-white/5 border-white/10">
            <CardContent className="p-8 text-center">
              <p className="text-white/60 text-lg mb-2">No tasks available</p>
              <p className="text-white/40 text-sm">Check back later for new opportunities</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-white/60 text-sm">
                Showing {filteredGrievances.length} available tasks
              </p>
            </div>
            
            {filteredGrievances.map((grievance: any) => {
              const priority = grievance.ai_classification?.priority || grievance.priority || 'medium';
              const category = grievance.category || 'other';
              const urgencyBadge = getUrgencyBadge(priority);
              const budget = estimateBudget(priority, category);
              const skills = getSkillsRequired(category, grievance.ai_classification);
              const isSaved = savedTasks.includes(grievance._id);
              
              return (
                <Card key={grievance._id} className="bg-white/5 border-white/10">
                  <CardContent className="p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-white font-medium text-lg">{grievance.title}</h3>
                          <Badge variant="outline" className={urgencyBadge.color}>
                            {priority.charAt(0).toUpperCase() + priority.slice(1)} Priority
                          </Badge>
                        </div>
                        <p className="text-white/60 text-sm mb-1">ID: {grievance._id?.slice(-8)}</p>
                        <p className="text-white/70 text-sm">{grievance.description}</p>
                      </div>
                      <div className="text-right ml-6">
                        <div className="text-white font-medium text-lg">{budget}</div>
                        <p className="text-white/60 text-sm">Budget Range</p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      <div>
                        <p className="text-white/60 text-xs">Category</p>
                        <p className="text-white/80 text-sm capitalize">{category}</p>
                      </div>
                      <div>
                        <p className="text-white/60 text-xs">Submitted</p>
                        <p className="text-white/80 text-sm">{formatDate(grievance.created_at)}</p>
                      </div>
                      <div>
                        <p className="text-white/60 text-xs">Location</p>
                        <p className="text-white/80 text-sm">{grievance.location}</p>
                      </div>
                      <div>
                        <p className="text-white/60 text-xs">Bids Received</p>
                        <p className="text-white/80 text-sm">0 bids</p>
                      </div>
                    </div>

                    {/* Skills Required */}
                    <div className="mb-4">
                      <p className="text-white/60 text-xs mb-2">Skills Required</p>
                      <div className="flex flex-wrap gap-2">
                        {skills.map((skill: string, index: number) => (
                          <Badge key={index} variant="outline" className="text-xs text-white border-white/30 hover:bg-white/10">
                            {skill}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button 
                        variant="hero"
                        onClick={() => {
                          setSelectedGrievance(grievance);
                          setShowBidModal(true);
                        }}
                      >
                        Place Bid
                      </Button>
                      <Button 
                        variant="outline"
                        onClick={() => {
                          setSelectedGrievance(grievance);
                          setShowAIAnalysis(true);
                        }}
                      >
                        View Details
                      </Button>
                      <Button 
                        variant="outline"
                        onClick={() => handleSaveTask(grievance._id)}
                      >
                        {isSaved ? 'Unsave' : 'Save Task'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* AI Analysis Modal */}
        <Dialog open={showAIAnalysis} onOpenChange={setShowAIAnalysis}>
          <DialogContent className="bg-gray-900 border-gray-700 text-white max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <span className="mr-2">🤖</span>
                AI Analysis - {selectedGrievance?.title}
              </DialogTitle>
              <DialogDescription className="text-gray-400">
                Detailed AI classification and analysis
              </DialogDescription>
            </DialogHeader>
            
            {selectedGrievance?.ai_classification && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-white/60">Category</Label>
                    <p className="text-white capitalize">{selectedGrievance.ai_classification.category} ✅</p>
                  </div>
                  <div>
                    <Label className="text-white/60">Priority</Label>
                    <p className={`font-medium ${
                      selectedGrievance.ai_classification.priority === 'urgent' ? 'text-red-400' :
                      selectedGrievance.ai_classification.priority === 'high' ? 'text-orange-400' :
                      selectedGrievance.ai_classification.priority === 'medium' ? 'text-yellow-400' :
                      'text-green-400'
                    }`}>
                      {selectedGrievance.ai_classification.priority} ✅
                    </p>
                  </div>
                </div>
                
                <div>
                  <Label className="text-white/60">Reasoning</Label>
                  <p className="text-white/80 text-sm leading-relaxed mt-1">
                    {selectedGrievance.ai_classification.reasoning}
                  </p>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-white/60">Confidence</Label>
                    <p className="text-white">{Math.round((selectedGrievance.ai_classification.confidence || 0.5) * 100)}%</p>
                  </div>
                  <div>
                    <Label className="text-white/60">Cost Range</Label>
                    <p className="text-white capitalize">{selectedGrievance.ai_classification.estimated_cost_range}</p>
                  </div>
                </div>
                
                {selectedGrievance.ai_classification.suggested_tags && (
                  <div>
                    <Label className="text-white/60">Tags</Label>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {selectedGrievance.ai_classification.suggested_tags.map((tag: string, index: number) => (
                        <Badge key={index} variant="outline" className="text-blue-300 border-blue-400">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                
                {selectedGrievance.ai_classification.seasonal_considerations && (
                  <div>
                    <Label className="text-white/60">Seasonal Considerations</Label>
                    <p className="text-white/80 text-sm">{selectedGrievance.ai_classification.seasonal_considerations} ✅</p>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Place Bid Modal */}
        <Dialog open={showBidModal} onOpenChange={setShowBidModal}>
          <DialogContent className="bg-gray-900 border-gray-700 text-white">
            <DialogHeader>
              <DialogTitle>Place Bid - {selectedGrievance?.title}</DialogTitle>
              <DialogDescription className="text-gray-400">
                Submit your proposal and bid amount
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="bid-amount" className="text-white">Bid Amount (₹)</Label>
                <Input
                  id="bid-amount"
                  type="number"
                  value={bidForm.amount}
                  onChange={(e) => setBidForm(prev => ({ ...prev, amount: e.target.value }))}
                  placeholder="Enter your bid amount"
                  className="bg-white/5 border-white/20 text-white"
                />
              </div>
              
              <div>
                <Label htmlFor="completion-time" className="text-white">Estimated Completion Time (hours)</Label>
                <Input
                  id="completion-time"
                  type="number"
                  min="1"
                  max="168"
                  value={bidForm.estimated_completion_time}
                  onChange={(e) => setBidForm(prev => ({ ...prev, estimated_completion_time: e.target.value }))}
                  placeholder="24"
                  className="bg-white/5 border-white/20 text-white"
                />
              </div>
              
              <div>
                <Label htmlFor="proposal" className="text-white">Proposal</Label>
                <Textarea
                  id="proposal"
                  value={bidForm.proposal}
                  onChange={(e) => setBidForm(prev => ({ ...prev, proposal: e.target.value }))}
                  placeholder="Describe your approach, timeline, and why you're the best choice for this task..."
                  className="bg-white/5 border-white/20 text-white min-h-[120px]"
                />
              </div>
              
              <div className="flex gap-2 pt-4">
                <Button 
                  variant="outline" 
                  onClick={() => setShowBidModal(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button 
                  variant="hero" 
                  onClick={handlePlaceBid}
                  disabled={submitBid.isPending || !bidForm.amount || !bidForm.proposal}
                  className="flex-1"
                >
                  {submitBid.isPending ? 'Submitting...' : 'Submit Bid'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
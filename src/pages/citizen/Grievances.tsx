import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useGrievances } from '@/hooks/useGrievances';
import { useWeb3 } from '@/contexts/Web3Context';
import { useState, useEffect, useMemo } from 'react';

const navigation = [
  { name: 'Dashboard', href: '/citizen/dashboard' },
  { name: 'Submit Grievance', href: '/citizen/submit-grievance' },
  { name: 'My Grievances', href: '/citizen/grievances' },
  { name: 'Voting & Governance', href: '/citizen/voting' },
];

export default function Grievances() {
  const { account } = useWeb3();
  const { data: allGrievances, isLoading, error } = useGrievances();
  
  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  
  // Filter user's grievances
  const userGrievances = useMemo(() => {
    if (!allGrievances || !account) return [];
    
    return allGrievances.filter(
      (grievance: any) => grievance.citizen_id?.toLowerCase() === account.toLowerCase()
    );
  }, [allGrievances, account]);

  // Apply filters
  const filteredGrievances = useMemo(() => {
    let filtered = userGrievances;

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter((g: any) => 
        g.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        g.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        g.location?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter((g: any) => {
        const status = g.status?.toLowerCase();
        switch (statusFilter) {
          case 'active':
            return status === 'pending' || status === 'classified' || status === 'active';
          case 'assigned':
            return status === 'assigned' || status === 'in_progress';
          case 'resolved':
            return status === 'resolved' || status === 'completed' || status === 'closed';
          default:
            return true;
        }
      });
    }

    // Category filter
    if (categoryFilter !== 'all') {
      filtered = filtered.filter((g: any) => g.category === categoryFilter);
    }

    return filtered.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [userGrievances, searchTerm, statusFilter, categoryFilter]);

  const getStatusBadge = (status: string) => {
    const normalizedStatus = status?.toLowerCase();
    
    if (normalizedStatus === 'resolved' || normalizedStatus === 'completed') {
      return { variant: 'default', color: 'text-green-400 border-green-400' };
    } else if (normalizedStatus === 'assigned' || normalizedStatus === 'in_progress') {
      return { variant: 'destructive', color: 'text-blue-400 border-blue-400' };
    } else if (normalizedStatus === 'classified' || normalizedStatus === 'active') {
      return { variant: 'secondary', color: 'text-purple-400 border-purple-400' };
    } else {
      return { variant: 'outline', color: 'text-yellow-400 border-yellow-400' };
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getDisplayStatus = (status: string) => {
    const normalizedStatus = status?.toLowerCase();
    if (normalizedStatus === 'pending') return 'Pending Review';
    if (normalizedStatus === 'classified') return 'Classified';
    if (normalizedStatus === 'active') return 'Available for Bids';
    if (normalizedStatus === 'assigned') return 'Worker Assigned';
    if (normalizedStatus === 'in_progress') return 'In Progress';
    if (normalizedStatus === 'resolved') return 'Resolved';
    if (normalizedStatus === 'completed') return 'Completed';
    return status || 'Unknown';
  };

  return (
    <DashboardLayout navigation={navigation} title="My Grievances">
      <div className="space-y-6">
        {/* Filters */}
        <Card className="bg-white/5 border-white/10">
          <CardHeader>
            <CardTitle className="text-white">Filter Grievances</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              <Input 
                placeholder="Search grievances..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-white/5 border-white/20 text-white placeholder:text-white/50 max-w-xs"
              />
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="bg-white/5 border-white/20 text-white w-48">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="active">Active (Pending/Classified)</SelectItem>
                  <SelectItem value="assigned">Assigned</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                </SelectContent>
              </Select>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="bg-white/5 border-white/20 text-white w-48">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="road">Road</SelectItem>
                  <SelectItem value="waste">Waste</SelectItem>
                  <SelectItem value="sewage">Sewage</SelectItem>
                  <SelectItem value="lighting">Lighting</SelectItem>
                  <SelectItem value="water">Water</SelectItem>
                  <SelectItem value="public_safety">Public Safety</SelectItem>
                  <SelectItem value="environment">Environment</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Grievances List */}
        {isLoading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <Card key={i} className="bg-white/5 border-white/10">
                <CardContent className="p-6">
                  <div className="animate-pulse">
                    <div className="h-6 bg-white/20 rounded w-3/4 mb-4"></div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {[...Array(4)].map((_, j) => (
                        <div key={j}>
                          <div className="h-4 bg-white/20 rounded w-1/2 mb-2"></div>
                          <div className="h-4 bg-white/20 rounded w-3/4"></div>
                        </div>
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
              <p className="text-red-400">Failed to load grievances. Please try again.</p>
            </CardContent>
          </Card>
        ) : filteredGrievances.length === 0 ? (
          <Card className="bg-white/5 border-white/10">
            <CardContent className="p-8 text-center">
              <p className="text-white/60 text-lg mb-2">
                {userGrievances.length === 0 ? 'No grievances submitted yet' : 'No grievances match your filters'}
              </p>
              <p className="text-white/40 text-sm">
                {userGrievances.length === 0 
                  ? 'Submit your first grievance to get started' 
                  : 'Try adjusting your search or filter criteria'
                }
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-white/60 text-sm">
                Showing {filteredGrievances.length} of {userGrievances.length} grievances
              </p>
            </div>
            
            {filteredGrievances.map((grievance: any) => {
              const statusBadge = getStatusBadge(grievance.status);
              
              return (
                <Card key={grievance._id} className="bg-white/5 border-white/10">
                  <CardContent className="p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex-1">
                        <h3 className="text-white font-medium text-lg mb-1">{grievance.title}</h3>
                        <p className="text-white/60 text-sm">ID: {grievance._id?.slice(-8)}</p>
                        <p className="text-white/70 text-sm mt-2 line-clamp-2">{grievance.description}</p>
                      </div>
                      <Badge variant="outline" className={statusBadge.color}>
                        {getDisplayStatus(grievance.status)}
                      </Badge>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      <div>
                        <p className="text-white/60 text-xs">Category</p>
                        <p className="text-white/80 text-sm capitalize">{grievance.category || 'Other'}</p>
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
                        <p className="text-white/60 text-xs">AI Priority</p>
                        <p className="text-white/80 text-sm capitalize">
                          {grievance.ai_classification?.priority || 'Pending'}
                        </p>
                      </div>
                    </div>

                    {/* AI Classification Details */}
                    {grievance.ai_classification && (
                      <div className="mb-4 p-4 bg-white/5 border border-white/10 rounded-lg">
                        <h4 className="text-white font-medium text-sm mb-3 flex items-center">
                          <span className="mr-2">🤖</span>
                          AI Analysis
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                          <div>
                            <span className="text-white/60">Category:</span>
                            <span className="text-white ml-2 capitalize">
                              {grievance.ai_classification.category} ✅
                            </span>
                          </div>
                          <div>
                            <span className="text-white/60">Priority:</span>
                            <span className={`ml-2 font-medium ${
                              grievance.ai_classification.priority === 'urgent' ? 'text-red-400' :
                              grievance.ai_classification.priority === 'high' ? 'text-orange-400' :
                              grievance.ai_classification.priority === 'medium' ? 'text-yellow-400' :
                              'text-green-400'
                            }`}>
                              {grievance.ai_classification.priority} ✅
                            </span>
                          </div>
                          <div className="md:col-span-2">
                            <span className="text-white/60">Reasoning:</span>
                            <p className="text-white/80 mt-1 text-xs leading-relaxed">
                              {grievance.ai_classification.reasoning}
                            </p>
                          </div>
                          <div>
                            <span className="text-white/60">Confidence:</span>
                            <span className="text-white ml-2">
                              {Math.round((grievance.ai_classification.confidence || 0.5) * 100)}%
                            </span>
                          </div>
                          {grievance.ai_classification.estimated_cost_range && (
                            <div>
                              <span className="text-white/60">Cost Range:</span>
                              <span className="text-white ml-2 capitalize">
                                {grievance.ai_classification.estimated_cost_range}
                              </span>
                            </div>
                          )}
                          {grievance.ai_classification.suggested_tags && grievance.ai_classification.suggested_tags.length > 0 && (
                            <div className="md:col-span-2">
                              <span className="text-white/60">Tags:</span>
                              <div className="mt-1 flex flex-wrap gap-1">
                                {grievance.ai_classification.suggested_tags.map((tag: string, index: number) => (
                                  <span key={index} className="px-2 py-1 bg-blue-500/20 text-blue-300 text-xs rounded">
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                          {grievance.ai_classification.seasonal_considerations && (
                            <div className="md:col-span-2">
                              <span className="text-white/60">Seasonal:</span>
                              <span className="text-white/80 ml-2 text-xs">
                                {grievance.ai_classification.seasonal_considerations} ✅
                              </span>
                            </div>
                          )}
                          {grievance.ai_classification.urgency_factors && grievance.ai_classification.urgency_factors.length > 0 && (
                            <div className="md:col-span-2">
                              <span className="text-white/60">Urgency Factors:</span>
                              <div className="mt-1">
                                {grievance.ai_classification.urgency_factors.map((factor: string, index: number) => (
                                  <span key={index} className="inline-block mr-2 text-xs text-orange-300">
                                    • {factor.replace(/_/g, ' ')}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                        {grievance.ai_classification.fallback && (
                          <div className="mt-2 text-xs text-white/50 border-t border-white/10 pt-2">
                            <span className="mr-1">ℹ️</span>
                            Classified using enhanced keyword analysis with Indian context
                          </div>
                        )}
                      </div>
                    )}

                    {grievance.image_url && (
                      <div className="mb-4">
                        <img 
                          src={grievance.image_url} 
                          alt="Grievance"
                          className="max-w-xs rounded-lg"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      </div>
                    )}

                    <div className="flex gap-2">
                      <Button variant="outline" size="sm">
                        View Details
                      </Button>
                      {grievance.status !== 'resolved' && grievance.status !== 'completed' && (
                        <Button variant="outline" size="sm">
                          Track Progress
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
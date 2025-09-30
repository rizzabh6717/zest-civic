import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useGrievances } from '@/hooks/useGrievances';
import { useWeb3 } from '@/contexts/Web3Context';
import { useState, useEffect } from 'react';

const navigation = [
  { name: 'Dashboard', href: '/citizen/dashboard' },
  { name: 'Submit Grievance', href: '/citizen/submit-grievance' },
  { name: 'My Grievances', href: '/citizen/grievances' },
  { name: 'Voting & Governance', href: '/citizen/voting' },
];

export default function CitizenDashboard() {
  const { account } = useWeb3();
  const { data: allGrievances, isLoading, error } = useGrievances();
  const [userGrievances, setUserGrievances] = useState([]);

  // Filter grievances for current user
  useEffect(() => {
    if (allGrievances && account) {
      console.log('=== DASHBOARD FILTERING DEBUG ===');
      console.log('User account:', account);
      console.log('Total grievances in database:', allGrievances.length);
      
      // Log all grievances with their citizen_ids
      allGrievances.forEach((g: any, index: number) => {
        console.log(`Grievance ${index + 1}:`, {
          id: g._id,
          title: g.title,
          citizen_id: g.citizen_id,
          status: g.status,
          matches: g.citizen_id?.toLowerCase() === account.toLowerCase()
        });
      });
      
      const filtered = allGrievances.filter(
        (grievance: any) => grievance.citizen_id?.toLowerCase() === account.toLowerCase()
      );
      
      console.log('Filtered user grievances:', filtered.length);
      console.log('User grievances details:', filtered);
      setUserGrievances(filtered);
    } else {
      console.log('Missing data for filtering:', { allGrievances: !!allGrievances, account });
    }
  }, [allGrievances, account]);

  // Debug: Log all status values to see what we're working with
  useEffect(() => {
    if (userGrievances.length > 0) {
      console.log('User grievance statuses:', userGrievances.map((g: any) => ({
        id: g._id,
        title: g.title,
        status: g.status,
        ai_classification: g.ai_classification
      })));
    }
  }, [userGrievances]);

  // Calculate stats from real data - backend sets new grievances as 'pending'
  const grievanceStats = {
    active: userGrievances.filter((g: any) => {
      const status = g.status?.toLowerCase();
      console.log('Checking grievance for active:', { id: g._id, title: g.title, status: g.status, statusLower: status });
      // Include all non-resolved statuses as "active"
      return status === 'pending' || status === 'classified' || status === 'active' || status === 'assigned' || status === 'in_progress' || !status;
    }).length,
    resolved: userGrievances.filter((g: any) => {
      const status = g.status?.toLowerCase();
      return status === 'resolved' || status === 'completed' || status === 'closed';
    }).length,
    total: userGrievances.length
  };

  // Additional debug logging
  console.log('Grievance Stats Calculation:', {
    totalGrievances: userGrievances.length,
    activeCount: grievanceStats.active,
    resolvedCount: grievanceStats.resolved,
    allStatuses: userGrievances.map(g => g.status)
  });

  // Calculate reputation based on resolved grievances
  const reputation = grievanceStats.total > 0 
    ? Math.round((grievanceStats.resolved / grievanceStats.total) * 100)
    : 0;

  // Calculate engagement (can be enhanced with more metrics)
  const engagement = grievanceStats.total > 0 ? Math.min(grievanceStats.total * 20, 100) : 0;

  // Format recent activity from actual grievances
  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Less than an hour ago';
    if (diffInHours < 24) return `${diffInHours} hours ago`;
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays === 1) return '1 day ago';
    return `${diffInDays} days ago`;
  };

  const recentActivity = userGrievances
    .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5)
    .map((grievance: any) => {
      // Normalize status for display based on backend flow
      let displayStatus = grievance.status || 'pending';
      const status = displayStatus.toLowerCase();
      
      if (status === 'resolved' || status === 'completed' || status === 'closed') {
        displayStatus = 'resolved';
      } else if (status === 'assigned' || status === 'in_progress') {
        displayStatus = 'assigned';
      } else if (status === 'pending' || status === 'classified' || status === 'active') {
        displayStatus = 'active';
      } else {
        displayStatus = 'pending';
      }
      
      return {
        id: grievance._id,
        action: `"${grievance.title}" - ${grievance.category || 'General'}`,
        time: formatTimeAgo(grievance.created_at),
        status: displayStatus,
        originalStatus: grievance.status
      };
    });

  if (isLoading) {
    return (
      <DashboardLayout navigation={navigation} title="Citizen Dashboard">
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <Card key={i} className="bg-white/5 border-white/10">
                <CardContent className="p-6">
                  <div className="animate-pulse">
                    <div className="h-4 bg-white/20 rounded w-3/4 mb-3"></div>
                    <div className="h-8 bg-white/20 rounded w-1/2"></div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout navigation={navigation} title="Citizen Dashboard">
        <Card className="bg-red-900/20 border-red-500/50">
          <CardContent className="p-6">
            <p className="text-red-400">Failed to load grievance data. Please try again.</p>
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout navigation={navigation} title="Citizen Dashboard">
      <div className="space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="bg-white/5 border-white/10">
            <CardHeader className="pb-3">
              <CardTitle className="text-white text-sm font-medium">Active Grievances</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-light text-white">{grievanceStats.active}</div>
              <p className="text-xs text-white/60 mt-1">Open & Assigned</p>
            </CardContent>
          </Card>

          <Card className="bg-white/5 border-white/10">
            <CardHeader className="pb-3">
              <CardTitle className="text-white text-sm font-medium">Resolved Grievances</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-light text-white">{grievanceStats.resolved}</div>
              <p className="text-xs text-white/60 mt-1">Successfully completed</p>
            </CardContent>
          </Card>

          <Card className="bg-white/5 border-white/10">
            <CardHeader className="pb-3">
              <CardTitle className="text-white text-sm font-medium">Reputation Score</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-light text-white">{reputation}</div>
              <Progress value={reputation} className="mt-2" />
              <p className="text-xs text-white/60 mt-1">Based on resolved issues</p>
            </CardContent>
          </Card>

          <Card className="bg-white/5 border-white/10">
            <CardHeader className="pb-3">
              <CardTitle className="text-white text-sm font-medium">Total Submitted</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-light text-white">{grievanceStats.total}</div>
              <p className="text-xs text-white/60 mt-1">All time submissions</p>
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity */}
        <Card className="bg-white/5 border-white/10">
          <CardHeader>
            <CardTitle className="text-white">Recent Grievances</CardTitle>
            <CardDescription className="text-white/70">Your latest submissions</CardDescription>
          </CardHeader>
          <CardContent>
            {recentActivity.length > 0 ? (
              <div className="space-y-4">
                {recentActivity.map((activity) => (
                  <div key={activity.id} className="flex items-center justify-between p-4 bg-white/5 rounded-lg">
                    <div className="flex-1">
                      <span className="text-white/80">{activity.action}</span>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge 
                          variant="outline" 
                          className={`text-xs ${
                            activity.status === 'resolved' ? 'border-green-500/50 text-green-400' :
                            activity.status === 'assigned' ? 'border-blue-500/50 text-blue-400' :
                            'border-yellow-500/50 text-yellow-400'
                          }`}
                        >
                          {activity.status}
                        </Badge>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-white/60 border-white/20">
                      {activity.time}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-white/60">No grievances submitted yet</p>
                <p className="text-white/40 text-sm mt-2">Submit your first grievance to get started</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
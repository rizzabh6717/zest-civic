import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';

const navigation = [
  { name: 'Dashboard', href: '/dao/dashboard' },
  { name: 'Governance', href: '/dao/governance' },
  { name: 'Bid Management', href: '/dao/bids' },
  { name: 'Member Directory', href: '/dao/members' },
];

export default function DAODashboard() {
  const mockData = {
    activeProposals: 4,
    totalMembers: 127,
    quorumRate: 68,
    executionRate: 85,
    recentProposals: [
      { id: 1, title: 'Community Budget Allocation Q3', status: 'Active', votes: 45, deadline: '3 days' },
      { id: 2, title: 'New Task Category: Environmental', status: 'Passed', votes: 89, deadline: 'Closed' },
      { id: 3, title: 'Worker Reputation Algorithm Update', status: 'Active', votes: 23, deadline: '5 days' },
    ]
  };

  return (
    <DashboardLayout navigation={navigation} title="DAO Governance Dashboard">
      <div className="space-y-6">
        {/* Alert for time-sensitive votes */}
        <Alert className="bg-blue-500/10 border-blue-500/20">
          <AlertDescription className="text-white/80">
            ⏰ Urgent: Community Budget Allocation vote ends in 3 days. Current participation: 45/127 members.
          </AlertDescription>
        </Alert>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="bg-white/5 border-white/10">
            <CardHeader className="pb-3">
              <CardTitle className="text-white text-sm font-medium">Active Proposals</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-light text-white">{mockData.activeProposals}</div>
            </CardContent>
          </Card>

          <Card className="bg-white/5 border-white/10">
            <CardHeader className="pb-3">
              <CardTitle className="text-white text-sm font-medium">Total Members</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-light text-white">{mockData.totalMembers}</div>
            </CardContent>
          </Card>

          <Card className="bg-white/5 border-white/10">
            <CardHeader className="pb-3">
              <CardTitle className="text-white text-sm font-medium">Quorum Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-light text-white">{mockData.quorumRate}%</div>
              <Progress value={mockData.quorumRate} className="mt-2" />
            </CardContent>
          </Card>

          <Card className="bg-white/5 border-white/10">
            <CardHeader className="pb-3">
              <CardTitle className="text-white text-sm font-medium">Execution Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-light text-white">{mockData.executionRate}%</div>
              <Progress value={mockData.executionRate} className="mt-2" />
            </CardContent>
          </Card>
        </div>

        {/* Active Proposals */}
        <Card className="bg-white/5 border-white/10">
          <CardHeader>
            <CardTitle className="text-white">Active Proposals</CardTitle>
            <CardDescription className="text-white/70">Current governance proposals requiring votes</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {mockData.recentProposals.map((proposal) => (
                <div key={proposal.id} className="flex items-center justify-between p-4 bg-white/5 rounded-lg">
                  <div>
                    <span className="text-white/80 font-medium">{proposal.title}</span>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge 
                        variant={proposal.status === 'Active' ? 'destructive' : 'default'}
                        className="text-xs"
                      >
                        {proposal.status}
                      </Badge>
                      <span className="text-white/60 text-sm">{proposal.votes} votes</span>
                      <span className="text-white/60 text-sm">• {proposal.deadline}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
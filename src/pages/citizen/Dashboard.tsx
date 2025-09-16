import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

const navigation = [
  { name: 'Dashboard', href: '/citizen/dashboard' },
  { name: 'Submit Grievance', href: '/citizen/submit-grievance' },
  { name: 'My Grievances', href: '/citizen/grievances' },
  { name: 'Voting & Governance', href: '/citizen/voting' },
  { name: 'Profile & Verification', href: '/citizen/profile' },
];

export default function CitizenDashboard() {
  const mockData = {
    grievances: { active: 3, resolved: 12, total: 15 },
    reputation: 85,
    engagement: 72,
    recentActivity: [
      { id: 1, action: 'Submitted grievance about road conditions', time: '2 hours ago' },
      { id: 2, action: 'Voted on community budget proposal', time: '1 day ago' },
      { id: 3, action: 'Grievance #GRV-001 was resolved', time: '3 days ago' },
    ]
  };

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
              <div className="text-2xl font-light text-white">{mockData.grievances.active}</div>
            </CardContent>
          </Card>

          <Card className="bg-white/5 border-white/10">
            <CardHeader className="pb-3">
              <CardTitle className="text-white text-sm font-medium">Resolved Grievances</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-light text-white">{mockData.grievances.resolved}</div>
            </CardContent>
          </Card>

          <Card className="bg-white/5 border-white/10">
            <CardHeader className="pb-3">
              <CardTitle className="text-white text-sm font-medium">Reputation Score</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-light text-white">{mockData.reputation}</div>
              <Progress value={mockData.reputation} className="mt-2" />
            </CardContent>
          </Card>

          <Card className="bg-white/5 border-white/10">
            <CardHeader className="pb-3">
              <CardTitle className="text-white text-sm font-medium">Engagement</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-light text-white">{mockData.engagement}%</div>
              <Progress value={mockData.engagement} className="mt-2" />
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity */}
        <Card className="bg-white/5 border-white/10">
          <CardHeader>
            <CardTitle className="text-white">Recent Activity</CardTitle>
            <CardDescription className="text-white/70">Your latest civic activities</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {mockData.recentActivity.map((activity) => (
                <div key={activity.id} className="flex items-center justify-between p-4 bg-white/5 rounded-lg">
                  <span className="text-white/80">{activity.action}</span>
                  <Badge variant="outline" className="text-white/60 border-white/20">
                    {activity.time}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
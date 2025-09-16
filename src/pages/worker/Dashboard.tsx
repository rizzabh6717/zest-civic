import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

const navigation = [
  { name: 'Dashboard', href: '/worker/dashboard' },
  { name: 'Task Marketplace', href: '/worker/marketplace' },
  { name: 'Reputation Profile', href: '/worker/reputation' },
];

export default function WorkerDashboard() {
  const mockData = {
    assignedTasks: 5,
    pendingBids: 3,
    monthlyEarnings: 1250,
    reputation: 92,
    recentTasks: [
      { id: 1, title: 'Road Pothole Repair - Main St', status: 'In Progress', payment: '$150' },
      { id: 2, title: 'Community Garden Maintenance', status: 'Completed', payment: '$75' },
      { id: 3, title: 'Street Light Installation', status: 'Pending Review', payment: '$200' },
    ]
  };

  return (
    <DashboardLayout navigation={navigation} title="Worker Dashboard">
      <div className="space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="bg-white/5 border-white/10">
            <CardHeader className="pb-3">
              <CardTitle className="text-white text-sm font-medium">Assigned Tasks</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-light text-white">{mockData.assignedTasks}</div>
            </CardContent>
          </Card>

          <Card className="bg-white/5 border-white/10">
            <CardHeader className="pb-3">
              <CardTitle className="text-white text-sm font-medium">Pending Bids</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-light text-white">{mockData.pendingBids}</div>
            </CardContent>
          </Card>

          <Card className="bg-white/5 border-white/10">
            <CardHeader className="pb-3">
              <CardTitle className="text-white text-sm font-medium">Monthly Earnings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-light text-white">${mockData.monthlyEarnings}</div>
            </CardContent>
          </Card>

          <Card className="bg-white/5 border-white/10">
            <CardHeader className="pb-3">
              <CardTitle className="text-white text-sm font-medium">Reputation</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-light text-white">{mockData.reputation}</div>
              <Progress value={mockData.reputation} className="mt-2" />
            </CardContent>
          </Card>
        </div>

        {/* Recent Tasks */}
        <Card className="bg-white/5 border-white/10">
          <CardHeader>
            <CardTitle className="text-white">Recent Tasks</CardTitle>
            <CardDescription className="text-white/70">Your latest work assignments</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {mockData.recentTasks.map((task) => (
                <div key={task.id} className="flex items-center justify-between p-4 bg-white/5 rounded-lg">
                  <div>
                    <span className="text-white/80 font-medium">{task.title}</span>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge 
                        variant={task.status === 'Completed' ? 'default' : 'outline'}
                        className="text-xs"
                      >
                        {task.status}
                      </Badge>
                      <span className="text-white/60 text-sm">{task.payment}</span>
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
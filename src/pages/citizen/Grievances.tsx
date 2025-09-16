import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const navigation = [
  { name: 'Dashboard', href: '/citizen/dashboard' },
  { name: 'Submit Grievance', href: '/citizen/submit-grievance' },
  { name: 'My Grievances', href: '/citizen/grievances' },
  { name: 'Voting & Governance', href: '/citizen/voting' },
  { name: 'Profile & Verification', href: '/citizen/profile' },
];

export default function Grievances() {
  const mockGrievances = [
    {
      id: 'GRV-001',
      title: 'Broken streetlight on Oak Avenue',
      category: 'Infrastructure',
      status: 'In Progress',
      submitted: '2024-01-15',
      priority: 'Medium',
      assignedWorker: 'John D.'
    },
    {
      id: 'GRV-002', 
      title: 'Potholes on Main Street intersection',
      category: 'Infrastructure',
      status: 'Under Review',
      submitted: '2024-01-10',
      priority: 'High',
      assignedWorker: 'Pending'
    },
    {
      id: 'GRV-003',
      title: 'Noise complaints from construction site',
      category: 'Public Safety',
      status: 'Resolved',
      submitted: '2024-01-05',
      priority: 'Low',
      assignedWorker: 'Sarah M.'
    }
  ];

  const getStatusBadge = (status: string) => {
    const statusColors = {
      'Resolved': 'default',
      'In Progress': 'destructive', 
      'Under Review': 'secondary',
      'Pending': 'outline'
    };
    return statusColors[status as keyof typeof statusColors] || 'outline';
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
                className="bg-white/5 border-white/20 text-white placeholder:text-white/50 max-w-xs"
              />
              <Select>
                <SelectTrigger className="bg-white/5 border-white/20 text-white w-48">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                </SelectContent>
              </Select>
              <Select>
                <SelectTrigger className="bg-white/5 border-white/20 text-white w-48">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="infrastructure">Infrastructure</SelectItem>
                  <SelectItem value="safety">Public Safety</SelectItem>
                  <SelectItem value="environment">Environment</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Grievances List */}
        <div className="space-y-4">
          {mockGrievances.map((grievance) => (
            <Card key={grievance.id} className="bg-white/5 border-white/10">
              <CardContent className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-white font-medium text-lg">{grievance.title}</h3>
                    <p className="text-white/60 text-sm">ID: {grievance.id}</p>
                  </div>
                  <Badge variant={getStatusBadge(grievance.status) as any}>
                    {grievance.status}
                  </Badge>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div>
                    <p className="text-white/60 text-xs">Category</p>
                    <p className="text-white/80 text-sm">{grievance.category}</p>
                  </div>
                  <div>
                    <p className="text-white/60 text-xs">Submitted</p>
                    <p className="text-white/80 text-sm">{grievance.submitted}</p>
                  </div>
                  <div>
                    <p className="text-white/60 text-xs">Priority</p>
                    <p className="text-white/80 text-sm">{grievance.priority}</p>
                  </div>
                  <div>
                    <p className="text-white/60 text-xs">Assigned Worker</p>
                    <p className="text-white/80 text-sm">{grievance.assignedWorker}</p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" size="sm">
                    View Details
                  </Button>
                  {grievance.status !== 'Resolved' && (
                    <Button variant="outline" size="sm">
                      Add Update
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
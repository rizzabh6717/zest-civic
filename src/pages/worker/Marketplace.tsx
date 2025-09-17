import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useGrievances, useSubmitBid } from '@/hooks/useGrievances';
import { useWeb3 } from '@/contexts/Web3Context';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';

const navigation = [
  { name: 'Dashboard', href: '/worker/dashboard' },
  { name: 'Task Marketplace', href: '/worker/marketplace' },
  { name: 'Reputation Profile', href: '/worker/reputation' },
];

export default function Marketplace() {
  const mockTasks = [
    {
      id: 'TSK-001',
      title: 'Road Pothole Repair - Main Street',
      description: 'Repair multiple potholes on Main Street between 1st and 3rd Avenue. Materials will be provided.',
      category: 'Infrastructure',
      budget: '$300-500',
      urgency: 'High',
      deadline: '2024-01-30',
      skillsRequired: ['Road Construction', 'Heavy Equipment'],
      bidsCount: 3,
      location: 'Main Street, Downtown',
      status: 'Open'
    },
    {
      id: 'TSK-002',
      title: 'Community Garden Maintenance',
      description: 'Weekly maintenance of community garden including weeding, watering, and general upkeep.',
      category: 'Environment',
      budget: '$75/week',
      urgency: 'Medium',
      deadline: '2024-02-15',
      skillsRequired: ['Gardening', 'Landscaping'],
      bidsCount: 1,
      location: 'Central Park Community Garden',
      status: 'Open'
    },
    {
      id: 'TSK-003',
      title: 'Security Camera Installation',
      description: 'Install 4 security cameras at the new playground. Technical expertise required.',
      category: 'Public Safety',
      budget: '$400-600',
      urgency: 'Medium',
      deadline: '2024-02-01',
      skillsRequired: ['Electrical Work', 'Security Systems'],
      bidsCount: 0,
      location: 'Riverside Park',
      status: 'Open'
    }
  ];

  const getUrgencyBadge = (urgency: string) => {
    const urgencyColors = {
      'High': 'destructive',
      'Medium': 'secondary',
      'Low': 'outline'
    };
    return urgencyColors[urgency as keyof typeof urgencyColors] || 'outline';
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
                className="bg-white/5 border-white/20 text-white placeholder:text-white/50 max-w-xs"
              />
              <Select>
                <SelectTrigger className="bg-white/5 border-white/20 text-white w-48">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="infrastructure">Infrastructure</SelectItem>
                  <SelectItem value="safety">Public Safety</SelectItem>
                  <SelectItem value="environment">Environment</SelectItem>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                </SelectContent>
              </Select>
              <Select>
                <SelectTrigger className="bg-white/5 border-white/20 text-white w-48">
                  <SelectValue placeholder="All Urgencies" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Urgencies</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Available Tasks */}
        <div className="space-y-4">
          {mockTasks.map((task) => (
            <Card key={task.id} className="bg-white/5 border-white/10">
              <CardContent className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-white font-medium text-lg">{task.title}</h3>
                      <Badge variant={getUrgencyBadge(task.urgency) as any}>
                        {task.urgency} Priority
                      </Badge>
                    </div>
                    <p className="text-white/60 text-sm mb-1">ID: {task.id}</p>
                    <p className="text-white/70 text-sm">{task.description}</p>
                  </div>
                  <div className="text-right ml-6">
                    <div className="text-white font-medium text-lg">{task.budget}</div>
                    <p className="text-white/60 text-sm">Budget Range</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div>
                    <p className="text-white/60 text-xs">Category</p>
                    <p className="text-white/80 text-sm">{task.category}</p>
                  </div>
                  <div>
                    <p className="text-white/60 text-xs">Deadline</p>
                    <p className="text-white/80 text-sm">{task.deadline}</p>
                  </div>
                  <div>
                    <p className="text-white/60 text-xs">Location</p>
                    <p className="text-white/80 text-sm">{task.location}</p>
                  </div>
                  <div>
                    <p className="text-white/60 text-xs">Bids Received</p>
                    <p className="text-white/80 text-sm">{task.bidsCount} bids</p>
                  </div>
                </div>

                {/* Skills Required */}
                <div className="mb-4">
                  <p className="text-white/60 text-xs mb-2">Skills Required</p>
                  <div className="flex flex-wrap gap-2">
                    {task.skillsRequired.map((skill, index) => (
                      <Badge key={index} variant="outline" className="text-xs">
                        {skill}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button variant="hero">
                    Place Bid
                  </Button>
                  <Button variant="outline">
                    View Details
                  </Button>
                  <Button variant="outline">
                    Save Task
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
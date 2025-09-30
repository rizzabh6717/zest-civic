import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Slider } from '@/components/ui/slider';

const navigation = [
  { name: 'Dashboard', href: '/citizen/dashboard' },
  { name: 'Submit Grievance', href: '/citizen/submit-grievance' },
  { name: 'My Grievances', href: '/citizen/grievances' },
  { name: 'Voting & Governance', href: '/citizen/voting' },
];

export default function Voting() {
  const mockProposals = [
    {
      id: 1,
      title: 'Community Budget Allocation Q3 2024',
      description: 'Decide how to allocate $50,000 in community funds across infrastructure, safety, and environmental projects.',
      options: [
        { name: 'Infrastructure Improvements', allocation: 0 },
        { name: 'Public Safety Initiatives', allocation: 0 },
        { name: 'Environmental Projects', allocation: 0 }
      ],
      totalCredits: 100,
      deadline: '2024-01-25',
      participated: false
    },
    {
      id: 2,
      title: 'New Community Center Operating Hours',
      description: 'Vote on the proposed operating schedule for the new community center.',
      currentVotes: 156,
      totalVoters: 230,
      deadline: '2024-01-22',
      participated: true
    }
  ];

  return (
    <DashboardLayout navigation={navigation} title="Voting & Governance">
      <div className="space-y-6">
        {/* Voting Credits */}
        <Card className="bg-white/5 border-white/10">
          <CardHeader>
            <CardTitle className="text-white">Your Voting Credits</CardTitle>
            <CardDescription className="text-white/70">
              Use quadratic voting to express preference intensity
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-3xl font-light text-white">100</div>
                <p className="text-white/60 text-sm">Available Credits</p>
              </div>
              <div className="text-right">
                <div className="text-xl font-light text-white/80">25</div>
                <p className="text-white/60 text-sm">Used This Period</p>
              </div>
            </div>
            <Progress value={25} className="mt-4" />
          </CardContent>
        </Card>

        {/* Active Proposals */}
        <div className="space-y-6">
          {mockProposals.map((proposal) => (
            <Card key={proposal.id} className="bg-white/5 border-white/10">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-white">{proposal.title}</CardTitle>
                    <CardDescription className="text-white/70 mt-2">
                      {proposal.description}
                    </CardDescription>
                  </div>
                  <div className="text-right">
                    <p className="text-white/60 text-sm">Deadline</p>
                    <p className="text-white/80">{proposal.deadline}</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Quadratic Voting Interface */}
                {proposal.options && (
                  <div className="space-y-4">
                    <h4 className="text-white font-medium">Allocate Your Credits</h4>
                    {proposal.options.map((option, index) => (
                      <div key={index} className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-white/80">{option.name}</span>
                          <span className="text-white/60">{option.allocation} credits</span>
                        </div>
                        <Slider
                          value={[option.allocation]}
                          max={50}
                          step={1}
                          className="w-full"
                        />
                      </div>
                    ))}
                    
                    <div className="flex gap-4 pt-4">
                      <Button variant="hero" disabled={proposal.participated}>
                        {proposal.participated ? 'Vote Submitted' : 'Submit Vote'}
                      </Button>
                      <Button variant="outline">
                        Reset Allocations
                      </Button>
                    </div>
                  </div>
                )}

                {/* Regular Voting Progress */}
                {proposal.currentVotes && (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-white/80">Participation</span>
                      <span className="text-white/60">
                        {proposal.currentVotes}/{proposal.totalVoters} voters
                      </span>
                    </div>
                    <Progress 
                      value={(proposal.currentVotes / proposal.totalVoters) * 100} 
                      className="w-full"
                    />
                    
                    {proposal.participated && (
                      <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3">
                        <p className="text-green-400 text-sm">✓ You have already voted on this proposal</p>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
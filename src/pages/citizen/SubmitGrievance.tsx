import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSubmitGrievance } from '@/hooks/useGrievances';
import { useWeb3 } from '@/contexts/Web3Context';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';

const navigation = [
  { name: 'Dashboard', href: '/citizen/dashboard' },
  { name: 'Submit Grievance', href: '/citizen/submit-grievance' },
  { name: 'My Grievances', href: '/citizen/grievances' },
  { name: 'Voting & Governance', href: '/citizen/voting' },
  { name: 'Profile & Verification', href: '/citizen/profile' },
];

export default function SubmitGrievance() {
  const { account } = useWeb3();
  const { toast } = useToast();
  const submitGrievance = useSubmitGrievance();
  
  const [formData, setFormData] = useState({
    title: '',
    category: '',
    location: '',
    description: '',
    image_url: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!account) {
      toast({
        title: "Wallet not connected",
        description: "Please connect your wallet to submit a grievance",
        variant: "destructive"
      });
      return;
    }

    try {
      await submitGrievance.mutateAsync({
        ...formData,
        citizen_id: account
      });
      
      toast({
        title: "Grievance submitted successfully",
        description: "Your grievance has been logged on the blockchain and will be classified by AI",
      });
      
      // Reset form
      setFormData({
        title: '',
        category: '',
        location: '',
        description: '',
        image_url: ''
      });
    } catch (error) {
      toast({
        title: "Failed to submit grievance",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive"
      });
    }
  };

  return (
    <DashboardLayout navigation={navigation} title="Submit Grievance">
      <div className="max-w-2xl">
        <Card className="bg-white/5 border-white/10">
          <CardHeader>
            <CardTitle className="text-white">File a New Grievance</CardTitle>
            <CardDescription className="text-white/70">
              Report a community issue that needs attention
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="title" className="text-white">Title</Label>
                <Input 
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Brief description of the issue"
                  className="bg-white/5 border-white/20 text-white placeholder:text-white/50"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="category" className="text-white">Category</Label>
                <Select value={formData.category} onValueChange={(value) => setFormData(prev => ({ ...prev, category: value }))}>
                  <SelectTrigger className="bg-white/5 border-white/20 text-white">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="road">Road Infrastructure</SelectItem>
                    <SelectItem value="waste">Waste Management</SelectItem>
                    <SelectItem value="sewage">Sewage & Water</SelectItem>
                    <SelectItem value="lighting">Street Lighting</SelectItem>
                    <SelectItem value="public_safety">Public Safety</SelectItem>
                    <SelectItem value="environment">Environment</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="location" className="text-white">Location</Label>
                <Input 
                  id="location"
                  value={formData.location}
                  onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                  placeholder="Specific location or address"
                  className="bg-white/5 border-white/20 text-white placeholder:text-white/50"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description" className="text-white">Description</Label>
                <Textarea 
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Detailed description of the issue"
                  className="bg-white/5 border-white/20 text-white placeholder:text-white/50 min-h-32"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="image_url" className="text-white">Image URL (Optional)</Label>
                <Input 
                  id="image_url"
                  value={formData.image_url}
                  onChange={(e) => setFormData(prev => ({ ...prev, image_url: e.target.value }))}
                  placeholder="Paste image URL here"
                  className="bg-white/5 border-white/20 text-white placeholder:text-white/50"
                />
              </div>

              <div className="flex gap-4 pt-4">
                <Button 
                  type="submit" 
                  variant="hero" 
                  className="flex-1"
                  disabled={submitGrievance.isPending}
                >
                  {submitGrievance.isPending ? 'Submitting...' : 'Submit Grievance'}
                </Button>
                <Button type="button" variant="outline" className="flex-1">
                  Save Draft
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const navigation = [
  { name: 'Dashboard', href: '/citizen/dashboard' },
  { name: 'Submit Grievance', href: '/citizen/submit-grievance' },
  { name: 'My Grievances', href: '/citizen/grievances' },
  { name: 'Voting & Governance', href: '/citizen/voting' },
  { name: 'Profile & Verification', href: '/citizen/profile' },
];

export default function SubmitGrievance() {
  return (
    <DashboardLayout navigation={navigation} title="Submit Grievance">
      <div className="max-w-2xl">
        <Card className="bg-white/5 border-white/10">
          <CardHeader>
            <CardTitle className="text-white">File a New Grievance</CardTitle>
            <CardDescription className="text-white/70">
              Provide detailed information about the issue you'd like to report
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="title" className="text-white">Title</Label>
              <Input 
                id="title" 
                placeholder="Brief description of the issue"
                className="bg-white/5 border-white/20 text-white placeholder:text-white/50"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category" className="text-white">Category</Label>
              <Select>
                <SelectTrigger className="bg-white/5 border-white/20 text-white">
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="infrastructure">Infrastructure</SelectItem>
                  <SelectItem value="public-safety">Public Safety</SelectItem>
                  <SelectItem value="utilities">Utilities</SelectItem>
                  <SelectItem value="environment">Environment</SelectItem>
                  <SelectItem value="governance">Governance</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="location" className="text-white">Location</Label>
              <Input 
                id="location" 
                placeholder="Street address or area"
                className="bg-white/5 border-white/20 text-white placeholder:text-white/50"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description" className="text-white">Description</Label>
              <Textarea 
                id="description" 
                placeholder="Provide detailed information about the issue..."
                className="bg-white/5 border-white/20 text-white placeholder:text-white/50 min-h-32"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="media" className="text-white">Media Attachments</Label>
              <Input 
                id="media" 
                type="file" 
                multiple
                className="bg-white/5 border-white/20 text-white file:text-white/70"
              />
            </div>

            <div className="flex gap-4 pt-4">
              <Button variant="hero" className="flex-1">
                Submit Grievance
              </Button>
              <Button variant="outline" className="flex-1">
                Save Draft
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
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
];

export default function SubmitGrievance() {
  const { account, contract, isConnected, isAuthenticated } = useWeb3();
  const { toast } = useToast();
  const submitGrievance = useSubmitGrievance();

  // Debug logging
  console.log('SubmitGrievance - Web3 State:', {
    account,
    isConnected,
    isAuthenticated,
    contractAvailable: !!contract
  });
  
  const [formData, setFormData] = useState({
    title: '',
    category: '',
    location: '',
    description: '',
    image_url: ''
  });

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const uploadImage = async (file: File): Promise<string> => {
    // Create a simple base64 data URL for now
    // In production, you'd upload to a cloud service like AWS S3, Cloudinary, etc.
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        resolve(reader.result as string);
      };
      reader.onerror = () => {
        reject(new Error('Failed to read file'));
      };
      reader.readAsDataURL(file);
    });
  };

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

    if (!isAuthenticated) {
      toast({
        title: "Not authenticated",
        description: "Please authenticate with your wallet first",
        variant: "destructive"
      });
      return;
    }

    try {
      setUploading(true);
      let imageUrl = formData.image_url;
      
      // Upload image if file is selected
      if (selectedFile) {
        try {
          imageUrl = await uploadImage(selectedFile);
        } catch (uploadError) {
          toast({
            title: "Image upload failed",
            description: "Proceeding without image",
            variant: "destructive"
          });
        }
      }

      // First submit to backend database
      let backendResponse;
      try {
        backendResponse = await submitGrievance.mutateAsync({
          ...formData,
          image_url: imageUrl,
          citizen_id: account
        });
      } catch (backendError) {
        console.error('Backend submission failed:', backendError);
        throw new Error('Failed to save grievance to database');
      }

      // Only show success message after database storage is confirmed
      if (backendResponse.success) {
        toast({
          title: "Grievance submitted successfully",
          description: "Your grievance has been stored in database and will be classified by AI",
        });

        // Then attempt blockchain submission immediately (no setTimeout)
        try {
          console.log('=== BLOCKCHAIN SUBMISSION FROM FORM ===');
          console.log('Backend response:', backendResponse);
          console.log('Backend response data:', backendResponse.data);

          if (!contract) {
            throw new Error('Contract not initialized');
          }

          // Create a hash of the grievance data for blockchain
          const grievanceId = backendResponse.data?._id || backendResponse.data?.id || Date.now();
          const grievanceHash = `grievance_${grievanceId}_${Date.now()}`;
          
          console.log('Grievance ID extracted:', grievanceId);
          console.log('Submitting to blockchain with hash:', grievanceHash);
          
          toast({
            title: "Submitting to blockchain...",
            description: "Please confirm the transaction in MetaMask",
          });

          const contractResult = await contract.submitGrievance(grievanceHash);
          console.log('Blockchain transaction result:', contractResult);
          
          const txHash = contractResult.transactionHash || 'Unknown';
          const blockchainGrievanceId = contractResult.grievanceId || 'Unknown';
          
          console.log('Transaction hash:', txHash);
          console.log('Blockchain grievance ID:', blockchainGrievanceId);
          
          toast({
            title: "✅ Blockchain transaction successful!",
            description: `Grievance recorded on blockchain! TX: ${txHash}`,
          });
        } catch (blockchainError) {
          console.error('Blockchain submission failed:', blockchainError);
          toast({
            title: "Blockchain submission failed",
            description: `Error: ${blockchainError.message}`,
            variant: "destructive"
          });
        }
      } else {
        throw new Error('Backend response indicates failure');
      }

      
      // Reset form
      setFormData({
        title: '',
        category: '',
        location: '',
        description: '',
        image_url: ''
      });
      setSelectedFile(null);
    } catch (error) {
      toast({
        title: "Failed to submit grievance",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive"
      });
    } finally {
      setUploading(false);
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
                <Label htmlFor="image" className="text-white">Upload Image (Optional)</Label>
                <div className="space-y-3">
                  <Input 
                    id="image"
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        // Validate file size (max 5MB)
                        if (file.size > 5 * 1024 * 1024) {
                          toast({
                            title: "File too large",
                            description: "Please select an image smaller than 5MB",
                            variant: "destructive"
                          });
                          return;
                        }
                        setSelectedFile(file);
                      }
                    }}
                    className="bg-white/5 border-white/20 text-white file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-medium file:bg-white/10 file:text-white hover:file:bg-white/20"
                  />
                  {selectedFile && (
                    <div className="flex items-center justify-between p-3 bg-white/5 border border-white/10 rounded-md">
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <span className="text-white text-sm">{selectedFile.name}</span>
                        <span className="text-white/60 text-xs">({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)</span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedFile(null)}
                        className="text-white/60 hover:text-white"
                      >
                        Remove
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <Button 
                  type="submit" 
                  variant="hero" 
                  className="w-full"
                  disabled={submitGrievance.isPending || uploading}
                >
                  {uploading ? 'Uploading...' : submitGrievance.isPending ? 'Submitting...' : 'Submit Grievance'}
                </Button>
              </div>
            </form>

          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
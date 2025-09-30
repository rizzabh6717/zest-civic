import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Brain, Loader2, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { aiAPI } from '@/services/api';

interface AITriggerButtonProps {
  grievanceId?: string;
  assignmentId?: string;
  type: 'classify' | 'verify' | 'analyze';
  variant?: 'default' | 'outline' | 'secondary';
  size?: 'sm' | 'default' | 'lg';
  disabled?: boolean;
  onSuccess?: (result: any) => void;
  proofImageUrl?: string;
  proofDescription?: string;
}

interface AIResult {
  success: boolean;
  data?: any;
  error?: string;
  timestamp: string;
}

export function AITriggerButton({
  grievanceId,
  assignmentId,
  type,
  variant = 'outline',
  size = 'default',
  disabled = false,
  onSuccess,
  proofImageUrl,
  proofDescription
}: AITriggerButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<AIResult | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const { toast } = useToast();

  const buttonConfig = {
    classify: {
      label: 'AI Classify',
      icon: Brain,
      description: 'Use AI to automatically classify this grievance',
      loadingText: 'Analyzing with Gemini AI...'
    },
    verify: {
      label: 'AI Verify',
      icon: CheckCircle,
      description: 'Use AI to verify task completion from proof images',
      loadingText: 'Verifying completion...'
    },
    analyze: {
      label: 'AI Analyze',
      icon: AlertTriangle,
      description: 'Use AI to analyze this image for issues',
      loadingText: 'Analyzing image...'
    }
  };

  const config = buttonConfig[type];
  const IconComponent = config.icon;

  const handleAITrigger = async () => {
    if (!grievanceId && !assignmentId) {
      toast({
        title: "Error",
        description: "Missing required ID for AI operation",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    setResult(null);

    try {
      let response;
      
      switch (type) {
        case 'classify':
          if (!grievanceId) throw new Error('Grievance ID required for classification');
          response = await aiAPI.classifyGrievance(grievanceId);
          break;
          
        case 'verify':
          if (!assignmentId || !proofImageUrl) {
            throw new Error('Assignment ID and proof image required for verification');
          }
          response = await aiAPI.verifyTask(assignmentId, {
            proof_image_url: proofImageUrl,
            proof_description: proofDescription || ''
          });
          break;
          
        case 'analyze':
          if (!proofImageUrl) throw new Error('Image URL required for analysis');
          response = await aiAPI.analyzeImage({
            image_url: proofImageUrl,
            context: proofDescription || '',
            analysis_type: 'grievance'
          });
          break;
          
        default:
          throw new Error('Invalid AI operation type');
      }

      const aiResult: AIResult = {
        success: response.success,
        data: response.data,
        timestamp: new Date().toISOString()
      };

      setResult(aiResult);
      setShowDialog(true);

      if (response.success) {
        toast({
          title: "AI Analysis Complete",
          description: `${config.label} completed successfully`,
        });
        
        if (onSuccess) {
          onSuccess(response.data);
        }
      } else {
        throw new Error(response.error || 'AI operation failed');
      }

    } catch (error: any) {
      console.error(`${type} AI operation failed:`, error);
      
      const aiResult: AIResult = {
        success: false,
        error: error.message || 'AI operation failed',
        timestamp: new Date().toISOString()
      };
      
      setResult(aiResult);
      setShowDialog(true);

      toast({
        title: "AI Operation Failed",
        description: error.message || 'Please try again later',
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const renderResult = () => {
    if (!result) return null;

    if (!result.success) {
      return (
        <Card className="w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <XCircle className="h-5 w-5" />
              AI Operation Failed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600">{result.error}</p>
            <p className="text-xs text-gray-400 mt-2">
              Failed at {new Date(result.timestamp).toLocaleString()}
            </p>
          </CardContent>
        </Card>
      );
    }

    // Success - render based on operation type
    const data = result.data;

    switch (type) {
      case 'classify':
        return (
          <Card className="w-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-600">
                <CheckCircle className="h-5 w-5" />
                Classification Complete
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-4">
                <div>
                  <p className="text-sm text-gray-500">Category</p>
                  <Badge variant="secondary">{data.classification?.category || 'Unknown'}</Badge>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Priority</p>
                  <Badge className={`${
                    data.classification?.priority === 'urgent' ? 'bg-red-100 text-red-800' :
                    data.classification?.priority === 'high' ? 'bg-orange-100 text-orange-800' :
                    data.classification?.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-green-100 text-green-800'
                  }`}>
                    {data.classification?.priority || 'Medium'}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Confidence</p>
                  <span className="font-semibold">
                    {Math.round((data.classification?.confidence || 0) * 100)}%
                  </span>
                </div>
              </div>
              {data.classification?.reasoning && (
                <div className="bg-gray-50 p-3 rounded">
                  <p className="text-sm">{data.classification.reasoning}</p>
                </div>
              )}
            </CardContent>
          </Card>
        );

      case 'verify':
        return (
          <Card className="w-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-600">
                <CheckCircle className="h-5 w-5" />
                Verification Complete
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-4">
                <div>
                  <p className="text-sm text-gray-500">Result</p>
                  <Badge className={data.verification?.approved ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                    {data.verification?.approved ? 'APPROVED' : 'REJECTED'}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Quality Score</p>
                  <span className="font-semibold">{data.verification?.quality_score || 'N/A'}/10</span>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Confidence</p>
                  <span className="font-semibold">
                    {Math.round((data.verification?.confidence || 0) * 100)}%
                  </span>
                </div>
              </div>
              {data.verification?.analysis && (
                <div className="bg-gray-50 p-3 rounded">
                  <p className="text-sm">{data.verification.analysis}</p>
                </div>
              )}
              {data.verification?.concerns && data.verification.concerns.length > 0 && (
                <div className="bg-yellow-50 p-3 rounded">
                  <p className="text-sm font-semibold mb-1">Concerns:</p>
                  <ul className="text-sm space-y-1">
                    {data.verification.concerns.map((concern: string, index: number) => (
                      <li key={index} className="flex items-start gap-1">
                        <span>•</span>
                        <span>{concern}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        );

      case 'analyze':
        return (
          <Card className="w-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-600">
                <CheckCircle className="h-5 w-5" />
                Analysis Complete
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.description && (
                <div>
                  <p className="text-sm text-gray-500 mb-1">Description</p>
                  <p className="text-sm">{data.description}</p>
                </div>
              )}
              {data.notable_features && data.notable_features.length > 0 && (
                <div>
                  <p className="text-sm text-gray-500 mb-1">Notable Features</p>
                  <div className="flex flex-wrap gap-1">
                    {data.notable_features.map((feature: string, index: number) => (
                      <Badge key={index} variant="outline" className="text-xs">
                        {feature}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        );

      default:
        return (
          <Card className="w-full">
            <CardContent>
              <pre className="text-xs bg-gray-100 p-2 rounded overflow-auto">
                {JSON.stringify(data, null, 2)}
              </pre>
            </CardContent>
          </Card>
        );
    }
  };

  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={handleAITrigger}
        disabled={disabled || isLoading}
        className="gap-2"
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <IconComponent className="h-4 w-4" />
        )}
        {isLoading ? config.loadingText : config.label}
      </Button>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-blue-600" />
              AI {config.label} Results
            </DialogTitle>
          </DialogHeader>
          <div className="mt-4">
            {renderResult()}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
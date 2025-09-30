import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { AlertTriangle, Brain, Clock, MapPin, Users, Zap } from 'lucide-react';

interface AIClassification {
  category: string;
  priority: string;
  reasoning: string;
  confidence: number;
  suggested_tags: string[];
  estimated_cost_range: string;
  urgency_factors: string[];
  local_impact?: string;
  seasonal_considerations?: string;
  timestamp: string;
  fallback?: boolean;
}

interface AIClassificationDisplayProps {
  classification: AIClassification;
  showFullDetails?: boolean;
}

const categoryIcons = {
  road: '🛣️',
  waste: '🗑️',
  sewage: '🚰',
  lighting: '💡',
  water: '💧',
  public_safety: '🚨',
  environment: '🌱',
  other: '📋'
};

const priorityColors = {
  low: 'bg-green-100 text-green-800',
  medium: 'bg-yellow-100 text-yellow-800',
  high: 'bg-orange-100 text-orange-800',
  urgent: 'bg-red-100 text-red-800'
};

const costColors = {
  low: 'text-green-600',
  medium: 'text-yellow-600',
  high: 'text-red-600'
};

export function AIClassificationDisplay({ 
  classification, 
  showFullDetails = false 
}: AIClassificationDisplayProps) {
  const confidencePercentage = Math.round(classification.confidence * 100);
  const categoryIcon = categoryIcons[classification.category as keyof typeof categoryIcons] || '📋';
  const priorityColor = priorityColors[classification.priority as keyof typeof priorityColors] || 'bg-gray-100 text-gray-800';
  const costColor = costColors[classification.estimated_cost_range as keyof typeof costColors] || 'text-gray-600';

  if (!showFullDetails) {
    // Compact display for cards/lists
    return (
      <div className="flex items-center gap-2 p-2 bg-blue-50 rounded-lg">
        <Brain className="h-4 w-4 text-blue-600" />
        <span className="text-sm font-medium">AI Classified:</span>
        <span className="text-lg">{categoryIcon}</span>
        <Badge className={priorityColor}>
          {classification.priority.toUpperCase()}
        </Badge>
        <div className="flex items-center gap-1">
          <Progress value={confidencePercentage} className="w-12 h-2" />
          <span className="text-xs text-gray-500">{confidencePercentage}%</span>
        </div>
        {classification.fallback && (
          <Badge variant="outline" className="text-xs">
            Fallback
          </Badge>
        )}
      </div>
    );
  }

  // Full detailed display
  return (
    <Card className="w-full">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-blue-600" />
          AI Classification Results
          {classification.fallback && (
            <Badge variant="outline" className="ml-auto">
              Keyword-Based Classification
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Category & Priority */}
        <div className="flex flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{categoryIcon}</span>
            <div>
              <p className="text-sm text-gray-500">Category</p>
              <p className="font-semibold capitalize">{classification.category.replace('_', ' ')}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            <div>
              <p className="text-sm text-gray-500">Priority</p>
              <Badge className={priorityColor}>
                {classification.priority.toUpperCase()}
              </Badge>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-purple-500" />
            <div>
              <p className="text-sm text-gray-500">Confidence</p>
              <div className="flex items-center gap-2">
                <Progress value={confidencePercentage} className="w-16 h-2" />
                <span className="text-sm font-semibold">{confidencePercentage}%</span>
              </div>
            </div>
          </div>
        </div>

        {/* AI Reasoning */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <h4 className="font-semibold mb-2 flex items-center gap-2">
            <Brain className="h-4 w-4" />
            AI Analysis
          </h4>
          <p className="text-sm text-gray-700">{classification.reasoning}</p>
        </div>

        {/* Cost Estimate */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">Estimated Cost:</span>
          <span className={`font-semibold ${costColor}`}>
            {classification.estimated_cost_range.toUpperCase()}
          </span>
        </div>

        {/* Tags */}
        {classification.suggested_tags && classification.suggested_tags.length > 0 && (
          <div>
            <p className="text-sm text-gray-500 mb-2">Suggested Tags:</p>
            <div className="flex flex-wrap gap-1">
              {classification.suggested_tags.map((tag, index) => (
                <Badge key={index} variant="secondary" className="text-xs">
                  #{tag}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Urgency Factors */}
        {classification.urgency_factors && classification.urgency_factors.length > 0 && (
          <div>
            <p className="text-sm text-gray-500 mb-2">Urgency Factors:</p>
            <div className="space-y-1">
              {classification.urgency_factors.map((factor, index) => (
                <div key={index} className="flex items-center gap-2 text-sm">
                  <AlertTriangle className="h-3 w-3 text-orange-500" />
                  <span className="capitalize">{factor.replace('_', ' ')}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Indian Context Information */}
        {classification.local_impact && (
          <div className="bg-orange-50 p-3 rounded-lg">
            <h4 className="font-semibold mb-1 flex items-center gap-2">
              <Users className="h-4 w-4 text-orange-600" />
              Local Impact
            </h4>
            <p className="text-sm text-gray-700">{classification.local_impact}</p>
          </div>
        )}

        {classification.seasonal_considerations && (
          <div className="bg-blue-50 p-3 rounded-lg">
            <h4 className="font-semibold mb-1 flex items-center gap-2">
              <Clock className="h-4 w-4 text-blue-600" />
              Seasonal Considerations
            </h4>
            <p className="text-sm text-gray-700">{classification.seasonal_considerations}</p>
          </div>
        )}

        {/* Timestamp */}
        <div className="text-xs text-gray-400 border-t pt-2">
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Classified on {new Date(classification.timestamp).toLocaleString()}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
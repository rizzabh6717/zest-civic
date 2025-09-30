import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Brain, TrendingUp, Target, Clock, AlertTriangle } from 'lucide-react';
import { aiAPI } from '@/services/api';

interface AIStats {
  total_classified: number;
  classifications_by_category: Array<{
    _id: string;
    count: number;
  }>;
  classifications_by_priority: Array<{
    _id: string;
    count: number;
  }>;
  confidence_stats: {
    avgConfidence: number;
    minConfidence: number;
    maxConfidence: number;
  };
  recent_classifications: Array<{
    title: string;
    ai_classification: {
      category: string;
      priority: string;
      confidence: number;
      timestamp: string;
    };
  }>;
}

export function AIStatsCard() {
  const [stats, setStats] = useState<AIStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadAIStats();
  }, []);

  const loadAIStats = async () => {
    try {
      setIsLoading(true);
      const response = await aiAPI.getStats();
      if (response.success) {
        setStats(response.data);
      } else {
        setError('Failed to load AI statistics');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load AI statistics');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 animate-pulse text-blue-600" />
            AI Performance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
            <div className="h-4 bg-gray-200 rounded animate-pulse w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded animate-pulse w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !stats) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-red-600" />
            AI Performance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="h-4 w-4" />
            <span className="text-sm">{error || 'No data available'}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const avgConfidencePercentage = Math.round(stats.confidence_stats.avgConfidence * 100) || 0;

  const categoryColors = {
    road: 'bg-blue-100 text-blue-800',
    waste: 'bg-green-100 text-green-800',
    sewage: 'bg-yellow-100 text-yellow-800',
    lighting: 'bg-purple-100 text-purple-800',
    water: 'bg-cyan-100 text-cyan-800',
    public_safety: 'bg-red-100 text-red-800',
    environment: 'bg-emerald-100 text-emerald-800',
    other: 'bg-gray-100 text-gray-800'
  };

  const priorityColors = {
    low: 'bg-green-100 text-green-800',
    medium: 'bg-yellow-100 text-yellow-800',
    high: 'bg-orange-100 text-orange-800',
    urgent: 'bg-red-100 text-red-800'
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-blue-600" />
          AI Performance Analytics
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Overall Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <Target className="h-4 w-4 text-blue-600" />
              <span className="text-2xl font-bold">{stats.total_classified}</span>
            </div>
            <p className="text-sm text-gray-500">Total Classified</p>
          </div>
          
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <TrendingUp className="h-4 w-4 text-green-600" />
              <span className="text-2xl font-bold">{avgConfidencePercentage}%</span>
            </div>
            <p className="text-sm text-gray-500">Avg Confidence</p>
          </div>
        </div>

        {/* Confidence Progress */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium">AI Confidence</span>
            <span className="text-sm text-gray-500">{avgConfidencePercentage}%</span>
          </div>
          <Progress value={avgConfidencePercentage} className="h-2" />
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>Min: {Math.round(stats.confidence_stats.minConfidence * 100)}%</span>
            <span>Max: {Math.round(stats.confidence_stats.maxConfidence * 100)}%</span>
          </div>
        </div>

        {/* Categories Distribution */}
        {stats.classifications_by_category.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <span>Categories</span>
              <Badge variant="outline" className="text-xs">
                {stats.classifications_by_category.length} types
              </Badge>
            </h4>
            <div className="space-y-2">
              {stats.classifications_by_category.slice(0, 5).map((cat) => {
                const percentage = Math.round((cat.count / stats.total_classified) * 100);
                const colorClass = categoryColors[cat._id as keyof typeof categoryColors] || categoryColors.other;
                
                return (
                  <div key={cat._id} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge className={`text-xs ${colorClass}`}>
                        {cat._id}
                      </Badge>
                      <span className="text-sm">{cat.count}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Progress value={percentage} className="w-16 h-2" />
                      <span className="text-xs text-gray-500 w-8">{percentage}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Priority Distribution */}
        {stats.classifications_by_priority.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold mb-3">Priority Levels</h4>
            <div className="grid grid-cols-2 gap-2">
              {stats.classifications_by_priority.map((priority) => {
                const percentage = Math.round((priority.count / stats.total_classified) * 100);
                const colorClass = priorityColors[priority._id as keyof typeof priorityColors] || priorityColors.medium;
                
                return (
                  <div key={priority._id} className="text-center p-2 rounded-lg bg-gray-50">
                    <Badge className={`text-xs mb-1 ${colorClass}`}>
                      {priority._id.toUpperCase()}
                    </Badge>
                    <div className="text-lg font-bold">{priority.count}</div>
                    <div className="text-xs text-gray-500">{percentage}%</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Recent Classifications */}
        {stats.recent_classifications.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Recent Classifications
            </h4>
            <div className="space-y-2">
              {stats.recent_classifications.slice(0, 3).map((item, index) => (
                <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge 
                        className={`text-xs ${categoryColors[item.ai_classification.category as keyof typeof categoryColors] || categoryColors.other}`}
                      >
                        {item.ai_classification.category}
                      </Badge>
                      <Badge 
                        className={`text-xs ${priorityColors[item.ai_classification.priority as keyof typeof priorityColors] || priorityColors.medium}`}
                      >
                        {item.ai_classification.priority}
                      </Badge>
                    </div>
                  </div>
                  <div className="text-right ml-2">
                    <div className="text-sm font-medium">
                      {Math.round(item.ai_classification.confidence * 100)}%
                    </div>
                    <div className="text-xs text-gray-500">
                      {new Date(item.ai_classification.timestamp).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="text-xs text-gray-400 text-center pt-2 border-t">
          Powered by Gemini 2.0 Flash • Last updated: {new Date().toLocaleString()}
        </div>
      </CardContent>
    </Card>
  );
}
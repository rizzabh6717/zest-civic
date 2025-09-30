import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { AlertTriangle, CheckCircle, Info, TrendingUp } from 'lucide-react';
import { useAIConfidence } from '@/hooks/useAI';

interface AIConfidenceIndicatorProps {
  confidence: number;
  showText?: boolean;
  showProgress?: boolean;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'badge' | 'detailed' | 'minimal';
}

export function AIConfidenceIndicator({
  confidence,
  showText = true,
  showProgress = false,
  size = 'md',
  variant = 'badge'
}: AIConfidenceIndicatorProps) {
  const { level, color, text, percentage, shouldShowWarning } = useAIConfidence(confidence);

  const getIcon = () => {
    switch (level) {
      case 'very-high':
      case 'high':
        return <CheckCircle className="h-3 w-3" />;
      case 'medium':
        return <Info className="h-3 w-3" />;
      case 'low':
        return <AlertTriangle className="h-3 w-3" />;
      default:
        return <TrendingUp className="h-3 w-3" />;
    }
  };

  const sizeClasses = {
    sm: 'text-xs px-1.5 py-0.5',
    md: 'text-sm px-2 py-1',
    lg: 'text-base px-3 py-1.5'
  };

  if (variant === 'minimal') {
    return (
      <span className={`inline-flex items-center gap-1 ${color} rounded px-1.5 py-0.5 text-xs`}>
        {getIcon()}
        {percentage}%
      </span>
    );
  }

  if (variant === 'detailed') {
    return (
      <div className={`${color} rounded-lg p-3 space-y-2`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {getIcon()}
            <span className="font-medium">{text}</span>
          </div>
          <span className="text-lg font-bold">{percentage}%</span>
        </div>
        
        {showProgress && (
          <div>
            <Progress 
              value={percentage} 
              className="h-2"
            />
            <div className="flex justify-between text-xs mt-1 opacity-75">
              <span>0%</span>
              <span>50%</span>
              <span>100%</span>
            </div>
          </div>
        )}
        
        {shouldShowWarning && (
          <div className="flex items-start gap-2 mt-2 p-2 bg-yellow-50 rounded border-l-2 border-yellow-400">
            <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm">
              <p className="font-medium text-yellow-800">Low Confidence Warning</p>
              <p className="text-yellow-700">
                This AI classification has low confidence. Consider manual review or additional context.
              </p>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Default badge variant
  return (
    <Badge 
      className={`${color} ${sizeClasses[size]} inline-flex items-center gap-1.5`}
      variant="secondary"
    >
      {getIcon()}
      {showText && <span>{text}</span>}
      <span className="font-semibold">{percentage}%</span>
    </Badge>
  );
}
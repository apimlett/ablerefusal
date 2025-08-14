'use client';

import React from 'react';
import { Loader2, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { GenerationStatus } from '@/lib/api';

interface GenerationProgressProps {
  status: GenerationStatus | null;
  onCancel?: () => void;
}

export default function GenerationProgress({ status, onCancel }: GenerationProgressProps) {
  if (!status) return null;

  const getStatusIcon = () => {
    switch (status.status) {
      case 'queued':
        return <AlertCircle className="w-5 h-5 text-palenight-yellow" />;
      case 'processing':
        return <Loader2 className="w-5 h-5 text-palenight-purple animate-spin" />;
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-palenight-green" />;
      case 'failed':
        return <XCircle className="w-5 h-5 text-palenight-red" />;
      case 'cancelled':
        return <XCircle className="w-5 h-5 text-palenight-orange" />;
      default:
        return null;
    }
  };

  const getStatusText = () => {
    switch (status.status) {
      case 'queued':
        return 'Queued for generation';
      case 'processing':
        return `Generating... (Step ${status.current_step}/${status.total_steps})`;
      case 'completed':
        return 'Generation complete!';
      case 'failed':
        return 'Generation failed';
      case 'cancelled':
        return 'Generation cancelled';
      default:
        return 'Unknown status';
    }
  };

  const getStatusColor = () => {
    switch (status.status) {
      case 'queued':
        return 'border-palenight-yellow';
      case 'processing':
        return 'border-palenight-purple';
      case 'completed':
        return 'border-palenight-green';
      case 'failed':
        return 'border-palenight-red';
      case 'cancelled':
        return 'border-palenight-orange';
      default:
        return 'border-palenight-border';
    }
  };

  return (
    <div className={`card border-2 ${getStatusColor()} animate-slide-up`}>
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-3">
          <div className="mt-0.5">{getStatusIcon()}</div>
          <div className="flex-1">
            <p className="text-palenight-textBright font-medium">{getStatusText()}</p>
            
            {/* Progress bar for processing */}
            {status.status === 'processing' && (
              <div className="mt-3">
                <div className="flex justify-between text-xs text-palenight-comment mb-1">
                  <span>Progress</span>
                  <span>{Math.round(status.progress)}%</span>
                </div>
                <div className="progress">
                  <div 
                    className="progress-bar"
                    style={{ width: `${status.progress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Error message */}
            {status.error && (
              <p className="mt-2 text-sm text-palenight-red">{status.error}</p>
            )}

            {/* Timing information */}
            {status.started_at && (
              <div className="mt-2 text-xs text-palenight-comment">
                {status.completed_at ? (
                  <span>
                    Duration: {calculateDuration(status.started_at, status.completed_at)}
                  </span>
                ) : (
                  <span>Started: {new Date(status.started_at).toLocaleTimeString()}</span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Cancel button */}
        {(status.status === 'queued' || status.status === 'processing') && onCancel && (
          <button
            onClick={onCancel}
            className="btn-ghost text-sm text-palenight-red hover:bg-palenight-red hover:bg-opacity-10"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}

function calculateDuration(startTime: string, endTime: string): string {
  const start = new Date(startTime).getTime();
  const end = new Date(endTime).getTime();
  const duration = end - start;
  
  if (duration < 1000) {
    return `${duration}ms`;
  } else if (duration < 60000) {
    return `${(duration / 1000).toFixed(1)}s`;
  } else {
    const minutes = Math.floor(duration / 60000);
    const seconds = Math.floor((duration % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  }
}
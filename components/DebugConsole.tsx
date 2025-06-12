'use client';

import { useEffect, useState } from 'react';

interface DebugConsoleProps {
  translated: number;
  total: number;
  percentage: number;
  currentChunk?: number;
  totalChunks?: number;
  message: string;
  status: 'idle' | 'translating' | 'quota_error' | 'retry' | 'complete' | 'error';
  retryAfter?: number;
}

export default function DebugConsole({
  translated,
  total,
  percentage,
  currentChunk,
  totalChunks,
  message,
  status,
  retryAfter
}: DebugConsoleProps) {
  const [timeLeft, setTimeLeft] = useState<number>(retryAfter || 0);
  const [showTooltip, setShowTooltip] = useState(false);

  // Countdown timer for quota retry
  useEffect(() => {
    if (status === 'quota_error' && retryAfter) {
      setTimeLeft(retryAfter);
      const interval = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [status, retryAfter]);

  const getStatusColor = () => {
    switch (status) {
      case 'translating': return 'text-blue-600';
      case 'quota_error': return 'text-yellow-600';
      case 'retry': return 'text-orange-600';
      case 'complete': return 'text-green-600';
      case 'error': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'translating': return '⚡';
      case 'quota_error': return '⏳';
      case 'retry': return '🔄';
      case 'complete': return '✅';
      case 'error': return '❌';
      default: return '⏸️';
    }
  };

  const getProgressBarColor = () => {
    switch (status) {
      case 'quota_error': return 'bg-yellow-500';
      case 'retry': return 'bg-orange-500';
      case 'complete': return 'bg-green-500';
      case 'error': return 'bg-red-500';
      default: return 'bg-blue-500';
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'quota_error': return 'QUOTA LIMIT - WAITING';
      case 'retry': return 'RESUMING TRANSLATION';
      default: return status.toUpperCase().replace('_', ' ');
    }
  };

  return (
    <div className="bg-gray-900 text-gray-100 p-6 rounded-lg font-mono text-sm">
      <div className="border-b border-gray-700 pb-4 mb-4">
        <h3 className="text-lg font-bold text-white mb-2">Translation Console</h3>
        <div className="flex items-center gap-2">
          <span className="text-2xl">{getStatusIcon()}</span>
          <span className={`font-semibold ${getStatusColor()}`}>
            {getStatusText()}
          </span>
          {status === 'quota_error' && (
            <div className="relative">
              <button
                onMouseEnter={() => setShowTooltip(true)}
                onMouseLeave={() => setShowTooltip(false)}
                className="ml-2 text-yellow-400 hover:text-yellow-300 transition-colors"
              >
                ℹ️
              </button>
              {showTooltip && (
                <div className="absolute left-6 top-0 z-10 w-72 p-3 bg-gray-800 border border-yellow-600 rounded-lg shadow-lg text-xs">
                  <div className="text-yellow-300 font-semibold mb-1">💡 Pro Tip</div>
                  <div className="text-gray-200 mb-2">
                    Free Gemini API has a limit of 10 requests/minute. 
                    With a paid API key, there's no wait time!
                  </div>
                  <div className="text-blue-300 text-xs">
                    📊{' '}
                    <a 
                      href="https://aistudio.google.com/usage" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="underline hover:text-blue-200"
                    >
                      Check API usage
                    </a>
                  </div>
                  <div className="absolute -left-2 top-2 w-0 h-0 border-t-4 border-r-4 border-t-transparent border-r-yellow-600 border-b-4 border-b-transparent"></div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="space-y-4">
        {/* Progress Bar */}
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span>Overall Progress</span>
            <span>{percentage}%</span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-3">
            <div 
              className={`h-3 rounded-full transition-all duration-300 ${getProgressBarColor()}`}
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>

        {/* Statistics Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-gray-800 p-3 rounded">
            <div className="text-gray-400 text-xs mb-1">Subtitles</div>
            <div className="text-white font-bold text-lg">
              {translated} / {total}
            </div>
          </div>
          
          {totalChunks && (
            <div className="bg-gray-800 p-3 rounded">
              <div className="text-gray-400 text-xs mb-1">Chunks</div>
              <div className="text-white font-bold text-lg">
                {currentChunk || 0} / {totalChunks}
              </div>
            </div>
          )}
        </div>

        {/* Quota Warning with Countdown */}
        {status === 'quota_error' && (
          <div className="bg-yellow-900/30 border border-yellow-600 rounded-lg p-4 animate-pulse">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-yellow-400 text-lg">⚠️</span>
              <div className="text-yellow-300 font-semibold">API QUOTA LIMIT REACHED</div>
            </div>
            <div className="space-y-2">
              <div className="text-yellow-200 text-sm">
                Free Gemini API allows only 10 requests per minute.
              </div>
              <div className="bg-yellow-800/40 rounded p-2">
                <div className="flex items-center justify-between">
                  <span className="text-yellow-100 text-sm font-medium">Resuming in:</span>
                  <span className="text-yellow-300 font-bold text-lg">
                    {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
                  </span>
                </div>
                <div className="w-full bg-yellow-800 rounded-full h-1 mt-2">
                  <div 
                    className="h-1 bg-yellow-400 rounded-full transition-all duration-1000"
                    style={{ width: `${Math.max(0, 100 - (timeLeft / (retryAfter || 65)) * 100)}%` }}
                  />
                </div>
              </div>
              <div className="text-yellow-300 text-xs">
                💡 With a paid API, there are no limits and translation wouldn't be interrupted
              </div>
            </div>
          </div>
        )}

        {/* Retry Status */}
        {status === 'retry' && (
          <div className="bg-orange-900/30 border border-orange-600 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-orange-400 text-lg animate-spin">🔄</span>
              <div className="text-orange-300 font-semibold">RESUMING TRANSLATION</div>
            </div>
            <div className="text-orange-200 text-sm">
              Quota limit reset. Continuing translation...
            </div>
            <div className="mt-2 flex items-center gap-2">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-orange-400 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-orange-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                <div className="w-2 h-2 bg-orange-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
              </div>
              <span className="text-orange-300 text-xs">Processing next chunk...</span>
            </div>
          </div>
        )}

        {/* Current Status Message */}
        <div className="bg-gray-800 p-3 rounded">
          <div className="text-gray-400 text-xs mb-1">Current Status</div>
          <div className="text-white text-sm">
            {message}
          </div>
        </div>

        {/* Technical Details */}
        <div className="border-t border-gray-700 pt-4">
          <div className="text-gray-400 text-xs mb-3">Technical Information</div>
          <div className="grid grid-cols-1 gap-2 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-400">Model:</span>
              <span className="text-gray-200">Gemini 2.0 Flash Exp</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">API Limit:</span>
              <span className="text-gray-200">10 requests/minute</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Batch Processing:</span>
              <span className="text-gray-200">Enabled</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Auto-Retry:</span>
              <span className="text-gray-200">65s delay</span>
            </div>
          </div>
        </div>

        {/* Progress Details */}
        {total > 0 && (
          <div className="border-t border-gray-700 pt-4">
            <div className="text-gray-400 text-xs mb-3">Progress Breakdown</div>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-400">Completed:</span>
                <span className="text-green-400">{translated} subtitles</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Remaining:</span>
                <span className="text-blue-400">{total - translated} subtitles</span>
              </div>
              {totalChunks && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Estimated Time:</span>
                  <span className="text-purple-400">
                    ~{Math.max(0, totalChunks - (currentChunk || 0))} chunks left
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

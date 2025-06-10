'use client';


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

  return (
    <div className="bg-gray-900 text-gray-100 p-6 rounded-lg font-mono text-sm">
      <div className="border-b border-gray-700 pb-4 mb-4">
        <h3 className="text-lg font-bold text-white mb-2">Translation Console</h3>
        <div className="flex items-center gap-2">
          <span className="text-2xl">{getStatusIcon()}</span>
          <span className={`font-semibold ${getStatusColor()}`}>
            {status.toUpperCase().replace('_', ' ')}
          </span>
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

        {/* Quota Warning */}
        {status === 'quota_error' && retryAfter && (
          <div className="bg-yellow-900/30 border border-yellow-600 rounded p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-yellow-400 text-lg">⚠️</span>
              <div className="text-yellow-300 font-semibold">QUOTA LIMIT HIT</div>
            </div>
            <div className="text-yellow-200 text-sm">
              API rate limit reached. Auto-retrying in {retryAfter} seconds...
            </div>
          </div>
        )}

        {/* Retry Status */}
        {status === 'retry' && (
          <div className="bg-orange-900/30 border border-orange-600 rounded p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-orange-400 text-lg">🔄</span>
              <div className="text-orange-300 font-semibold">RESUMING</div>
            </div>
            <div className="text-orange-200 text-sm">
              Quota limit reset. Continuing translation...
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

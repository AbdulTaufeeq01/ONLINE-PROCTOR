'use client';

import { cn } from '@/lib/utils';

interface TimerProps {
  timeString: string; // MM:SS format
  isExpired: boolean;
  durationMinutes: number;
  currentSeconds: number; // timeLeft in seconds
}

/**
 * Countdown timer display component
 * Shows time with color states: normal, warning, critical, expired
 */
export function Timer({
  timeString,
  isExpired,
  durationMinutes,
  currentSeconds,
}: TimerProps) {
  const totalSeconds = durationMinutes * 60;
  const minutesLeft = Math.floor(currentSeconds / 60);

  // Determine state
  const isWarning = currentSeconds <= 300 && currentSeconds > 60; // 5 min to 1 min
  const isCritical = currentSeconds <= 60 && currentSeconds > 0; // Less than 1 min

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-lg p-4 transition-all',
        isExpired
          ? 'bg-red-600 text-white'
          : isCritical
            ? 'bg-red-100 text-red-700'
            : isWarning
              ? 'bg-yellow-100 text-yellow-700'
              : 'bg-gray-100 text-gray-700'
      )}
    >
      {/* Label */}
      <span className="text-xs font-semibold uppercase tracking-wide opacity-75">
        {isExpired ? "Time's Up" : 'Time Remaining'}
      </span>

      {/* Time Display */}
      <div
        className={cn(
          'mt-2 text-4xl font-bold font-mono tracking-tight',
          isCritical && !isExpired && 'animate-pulse'
        )}
      >
        {isExpired ? "00:00" : timeString}
      </div>

      {/* Warning Text */}
      {isWarning && !isExpired && (
        <span className="mt-2 text-sm font-medium">
          {minutesLeft} minute{minutesLeft !== 1 ? 's' : ''} remaining
        </span>
      )}

      {/* Critical Text */}
      {isCritical && !isExpired && (
        <span className="mt-2 text-sm font-semibold animate-pulse">
          Less than 1 minute!
        </span>
      )}

      {/* Progress Indicator */}
      <div className="mt-3 w-full max-w-xs h-1 bg-black bg-opacity-10 rounded-full overflow-hidden">
        <div
          className={cn(
            'h-full transition-all',
            isExpired
              ? 'w-0 bg-white'
              : isCritical
                ? 'bg-red-500 animate-pulse'
                : isWarning
                  ? 'bg-yellow-500'
                  : 'bg-gray-400'
          )}
          style={{
            width: `${(currentSeconds / totalSeconds) * 100}%`,
          }}
        />
      </div>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';

interface UseExamTimerReturn {
  timeLeft: number; // in seconds
  isExpired: boolean;
  timeString: string; // MM:SS format
}

/**
 * Countdown timer hook for exam taking
 * @param durationMinutes - Exam duration in minutes
 * @param onExpire - Callback when timer reaches 0
 * @param onWarning - Callback at 5 min and 1 min remaining (minutesLeft)
 * @returns { timeLeft, isExpired, timeString }
 */
export function useExamTimer(
  durationMinutes: number,
  onExpire?: () => void,
  onWarning?: (minutesLeft: number) => void
): UseExamTimerReturn {
  const [timeLeft, setTimeLeft] = useState<number>(durationMinutes * 60);
  const [isExpired, setIsExpired] = useState<boolean>(false);
  const [hasWarned5Min, setHasWarned5Min] = useState<boolean>(false);
  const [hasWarned1Min, setHasWarned1Min] = useState<boolean>(false);

  // Format seconds to MM:SS
  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    // Skip if already expired
    if (isExpired) return;

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        const newTimeLeft = Math.max(0, prev - 1);

        // Check 5-minute warning
        if (newTimeLeft === 300 && !hasWarned5Min) {
          setHasWarned5Min(true);
          onWarning?.(5);
        }

        // Check 1-minute warning
        if (newTimeLeft === 60 && !hasWarned1Min) {
          setHasWarned1Min(true);
          onWarning?.(1);
        }

        // Timer expired
        if (newTimeLeft === 0) {
          setIsExpired(true);
          onExpire?.();
          clearInterval(interval);
        }

        return newTimeLeft;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isExpired, hasWarned5Min, hasWarned1Min, onExpire, onWarning]);

  return {
    timeLeft,
    isExpired,
    timeString: formatTime(timeLeft),
  };
}

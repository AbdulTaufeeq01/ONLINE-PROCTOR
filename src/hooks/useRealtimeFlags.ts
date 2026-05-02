'use client';

import { useEffect, useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { Flag } from '@/types/database';

interface UseRealtimeFlagsReturn {
  flags: Flag[];
}

/**
 * Real-time flag subscription hook
 * @param examId - Exam ID to subscribe to flags for
 * @returns { flags }
 */
export function useRealtimeFlags(examId: string): UseRealtimeFlagsReturn {
  const [flags, setFlags] = useState<Flag[]>([]);

  useEffect(() => {
    // Don't subscribe if no exam ID
    if (!examId) return;

    const supabase = createSupabaseBrowserClient();

    // Subscribe to new flags for this exam
    const channel = supabase
      .channel(`flags-${examId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'flags',
          filter: `exam_id=eq.${examId}`,
        },
        (payload) => {
          const newFlag = payload.new as Flag;
          setFlags((prev) => [newFlag, ...prev]);
        }
      )
      .subscribe();

    // Cleanup subscription on unmount
    return () => {
      supabase.removeChannel(channel);
    };
  }, [examId]);

  return { flags };
}

'use client';

import { useEffect, useState } from 'react';

interface UseAutoSaveReturn {
  lastSaved: Date | null;
  isSaving: boolean;
  saveNow: () => Promise<void>;
}

/**
 * Auto-save answers hook
 * @param sessionId - Current session ID
 * @param answers - Current answers object
 * @param intervalMs - Auto-save interval in milliseconds (default: 30000)
 * @returns { lastSaved, isSaving, saveNow }
 */
export function useAutoSave(
  sessionId: string,
  answers: Record<string, string>,
  intervalMs: number = 30000
): UseAutoSaveReturn {
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const saveAnswers = async () => {
    // Skip if no session or empty answers
    if (!sessionId || Object.keys(answers).length === 0) return;

    try {
      setIsSaving(true);
      const response = await fetch('/api/submit-exam', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          exam_id: '', // Will be handled by API based on session
          answers,
          auto_save: true,
        }),
      });

      if (response.ok) {
        setLastSaved(new Date());
      }
    } catch (error) {
      console.error('Auto-save error:', error);
      // Fail silently - don't interrupt exam
    } finally {
      setIsSaving(false);
    }
  };

  // Auto-save interval
  useEffect(() => {
    if (!sessionId || Object.keys(answers).length === 0) return;

    const interval = setInterval(() => {
      saveAnswers();
    }, intervalMs);

    return () => clearInterval(interval);
  }, [sessionId, answers, intervalMs]);

  // Save on page unload
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // Save synchronously if possible
      if (sessionId && Object.keys(answers).length > 0) {
        saveAnswers();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [sessionId, answers]);

  return {
    lastSaved,
    isSaving,
    saveNow: saveAnswers,
  };
}

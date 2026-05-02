import { useCallback, useRef, useEffect } from 'react'

/**
 * Enhanced Behavioral Tracking for Proctoring
 * Captures detailed keystroke, paste, and focus events
 */

export interface KeystrokeEvent {
  timestamp: number
  charCount: number
  duration: number // ms since last keystroke
}

export interface PasteEvent {
  timestamp: number
  charCount: number
}

export interface BehavioralLog {
  sessionId: string
  questionId: string
  tabSwitches: number
  pasteEvents: PasteEvent[]
  keystrokes: KeystrokeEvent[]
  mouseLeaveEvents: number
  focusLossEvents: number
  windowBlurCount: number
  totalTimeSeconds: number
  lastActivity: number // timestamp
  suspiciousPatterns: string[]
}

const KEYSTROKE_SAMPLE_INTERVAL = 2000 // Sample every 2 seconds
const FOCUS_DEBOUNCE = 500 // Debounce focus events

export function useEnhancedProctoring(
  sessionId: string,
  questionId: string
) {
  const logRef = useRef<BehavioralLog>({
    sessionId,
    questionId,
    tabSwitches: 0,
    pasteEvents: [],
    keystrokes: [],
    mouseLeaveEvents: 0,
    focusLossEvents: 0,
    windowBlurCount: 0,
    totalTimeSeconds: 0,
    lastActivity: Date.now(),
    suspiciousPatterns: [],
  })

  const keystrokeCountRef = useRef(0)
  const lastKeystrokeRef = useRef(Date.now())
  const focusTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // ── Track Paste Events ────────────────────────────────────────────────────
  const handlePaste = useCallback((e: ClipboardEvent) => {
    try {
      const pastedText = e.clipboardData?.getData('text') || ''
      const charCount = pastedText.length

      console.log('[proctoring] Paste detected:', charCount, 'characters')

      logRef.current.pasteEvents.push({
        timestamp: Date.now(),
        charCount,
      })

      logRef.current.lastActivity = Date.now()

      // Flag large pastes
      if (charCount > 100) {
        logRef.current.suspiciousPatterns.push(
          `Large paste detected: ${charCount} characters`
        )
        console.log('[proctoring] ⚠️ Suspicious: Large paste')
      }

      // Log to backend
      try {
        fetch('/api/flag-event', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_id: sessionId,
            student_id: '', // Will be extracted from session
            exam_id: '',
            event_type: 'paste_detected',
            confidence: Math.min(0.95, 0.5 + charCount / 200), // Higher confidence for larger pastes
            metadata: {
              char_count: charCount,
              text_sample: pastedText.substring(0, 50),
            },
            severity: charCount > 200 ? 'high' : 'medium',
            log_type: 'behavior_log',
          }),
        }).catch(() => {}) // Silently fail if backend unavailable
      } catch {}
    } catch (err) {
      console.error('[proctoring] Error handling paste:', err)
    }
  }, [sessionId])

  // ── Track Keystrokes ─────────────────────────────────────────────────────
  const handleKeydown = useCallback(() => {
    keystrokeCountRef.current++
    const now = Date.now()
    const timeSinceLast = now - lastKeystrokeRef.current

    if (timeSinceLast > KEYSTROKE_SAMPLE_INTERVAL) {
      // Detect typing bursts (>200 chars in <3 seconds)
      if (keystrokeCountRef.current > 200 && timeSinceLast < 3000) {
        logRef.current.suspiciousPatterns.push(
          `Typing burst: ${keystrokeCountRef.current} chars in ${timeSinceLast}ms`
        )
        console.log('[proctoring] ⚠️ Suspicious: Typing burst detected')
      }

      logRef.current.keystrokes.push({
        timestamp: now,
        charCount: keystrokeCountRef.current,
        duration: timeSinceLast,
      })

      keystrokeCountRef.current = 0
      lastKeystrokeRef.current = now
    }

    logRef.current.lastActivity = now
  }, [])

  // ── Track Mouse Leave ────────────────────────────────────────────────────
  const handleMouseLeave = useCallback(() => {
    logRef.current.mouseLeaveEvents++
    console.log('[proctoring] 🖱️ Mouse left exam area')
  }, [])

  // ── Track Focus Loss ────────────────────────────────────────────────────
  const handleBlur = useCallback(() => {
    logRef.current.windowBlurCount++

    if (focusTimeoutRef.current) clearTimeout(focusTimeoutRef.current)

    focusTimeoutRef.current = setTimeout(() => {
      logRef.current.focusLossEvents++
      console.log('[proctoring] ⚠️ Focus lost for >500ms')
    }, FOCUS_DEBOUNCE)
  }, [])

  const handleFocus = useCallback(() => {
    if (focusTimeoutRef.current) {
      clearTimeout(focusTimeoutRef.current)
      focusTimeoutRef.current = null
    }
  }, [])

  // ── Track Tab Switches (Visibility API) ─────────────────────────────────
  // FIX: This listener was missing — without it, tabSwitches was always 0
  const handleVisibilityChange = useCallback(() => {
    if (document.hidden) {
      logRef.current.tabSwitches++
      console.log('[proctoring] ⚠️ Tab switched away (count:', logRef.current.tabSwitches, ')')
    }
  }, [])

  // ── Initialize Tracking ──────────────────────────────────────────────────
  useEffect(() => {
    logRef.current.sessionId = sessionId
    logRef.current.questionId = questionId

    document.addEventListener('paste', handlePaste)
    document.addEventListener('keydown', handleKeydown)
    document.addEventListener('mouseleave', handleMouseLeave)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('blur', handleBlur)
    window.addEventListener('focus', handleFocus)

    return () => {
      document.removeEventListener('paste', handlePaste)
      document.removeEventListener('keydown', handleKeydown)
      document.removeEventListener('mouseleave', handleMouseLeave)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('blur', handleBlur)
      window.removeEventListener('focus', handleFocus)

      if (focusTimeoutRef.current) {
        clearTimeout(focusTimeoutRef.current)
      }
    }
  }, [sessionId, questionId, handlePaste, handleKeydown, handleMouseLeave, handleVisibilityChange, handleBlur, handleFocus])

  // ── Get Current Log ──────────────────────────────────────────────────────
  const getCurrentLog = useCallback((): BehavioralLog => {
    const now = Date.now()
    const startTime = logRef.current.keystrokes[0]?.timestamp ?? now
    logRef.current.totalTimeSeconds = Math.round((now - startTime) / 1000)

    return {
      ...logRef.current,
      lastActivity: now,
    }
  }, [])

  // ── Submit Log to Backend ────────────────────────────────────────────────
  const submitLog = useCallback(
    async (studentId: string, examId: string) => {
      const log = getCurrentLog()

      try {
        // FIX: Changed from /api/behavioral-logs (non-existent) to /api/flag-event (correct endpoint)
        const response = await fetch('/api/flag-event', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_id: sessionId,
            student_id: studentId,
            exam_id: examId,
            event_type: 'behavioral_summary',
            confidence: 0.75,
            metadata: {
              question_id: questionId,
              tab_switches: log.tabSwitches,
              paste_events: log.pasteEvents.length,
              keystroke_timeline: log.keystrokes,
              mouse_leave_events: log.mouseLeaveEvents,
              focus_loss_events: log.focusLossEvents,
              window_blur_count: log.windowBlurCount,
              total_time_seconds: log.totalTimeSeconds,
              suspicious_patterns: log.suspiciousPatterns,
            },
            log_type: 'behavior_log',
          }),
        })

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }

        console.log('[proctoring] ✅ Behavioral log submitted')
        return true
      } catch (err) {
        console.error('[proctoring] Failed to submit behavioral log:', err)
        return false
      }
    },
    [sessionId, questionId, getCurrentLog]
  )

  // ── Analyze Current Behavior for Warnings ───────────────────────────────
  const analyzeCurrentBehavior = useCallback(() => {
    const log = getCurrentLog()
    const warnings: string[] = []

    if (log.pasteEvents.length > 3) {
      warnings.push(`Multiple paste events (${log.pasteEvents.length})`)
    }

    if (log.focusLossEvents > 5) {
      warnings.push(`Frequent focus loss (${log.focusLossEvents} times)`)
    }

    const totalPastedChars = log.pasteEvents.reduce((sum, e) => sum + e.charCount, 0)
    if (totalPastedChars > 500) {
      warnings.push(`Excessive pasted content (${totalPastedChars} characters)`)
    }

    return {
      warnings,
      suspiciousPatterns: log.suspiciousPatterns,
      riskLevel:
        warnings.length > 3 ? 'high'
        : warnings.length > 1 ? 'medium'
        : 'low',
    }
  }, [getCurrentLog])

  return {
    getCurrentLog,
    submitLog,
    analyzeCurrentBehavior,
    log: logRef.current,
  }
}

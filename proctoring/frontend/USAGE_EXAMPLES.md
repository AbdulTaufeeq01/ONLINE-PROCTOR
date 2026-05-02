# Proctoring Frontend - Usage Examples

Complete integration examples for implementing proctoring in your exam application.

---

## Example 1: Basic Exam with Full Proctoring

```typescript
// components/exam/ExamTaker.tsx
'use client'

import { useState, useEffect } from 'react'
import ProctoringSession from '@/proctoring/frontend/ProctoringSession'
import ProctoringOverlay from '@/proctoring/frontend/ProctoringOverlay'
import { useRouter } from 'next/navigation'

interface ExamTakerProps {
  examId: string
  sessionId: string
  studentId: string
}

export default function ExamTaker({ examId, sessionId, studentId }: ExamTakerProps) {
  const router = useRouter()
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [isReady, setIsReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Request camera and microphone permissions
  useEffect(() => {
    const requestPermissions = async () => {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: 'user',
          },
          audio: true,
        })

        setStream(mediaStream)
        setIsReady(true)
      } catch (err: any) {
        let errorMsg = 'Failed to access camera/microphone'

        if (err.name === 'NotAllowedError') {
          errorMsg = 'You must allow camera and microphone access to take this exam'
        } else if (err.name === 'NotFoundError') {
          errorMsg = 'Camera or microphone not found on this device'
        }

        setError(errorMsg)
      }
    }

    requestPermissions()

    return () => {
      // Cleanup
      stream?.getTracks().forEach((track) => track.stop())
    }
  }, [stream])

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-red-50">
        <div className="bg-white p-8 rounded-lg shadow-lg max-w-md">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Permission Error</h2>
          <p className="text-gray-700">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-6 w-full bg-red-600 text-white py-2 rounded-lg hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  if (!isReady || !stream) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Initializing proctoring...</p>
        </div>
      </div>
    )
  }

  const handleSubmitExam = async () => {
    // Submit exam answers
    const answers = {
      /* exam answers */
    }

    // Upload answers
    const response = await fetch('/api/submit-exam', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, answers }),
    })

    if (response.ok) {
      // Proctoring stops via ProctoringOverlay
      router.push(`/exam/report/${sessionId}`)
    }
  }

  return (
    <div className="relative w-full h-screen bg-white">
      {/* Main exam content */}
      <div className="p-6">
        <h1 className="text-3xl font-bold mb-6">Exam</h1>

        {/* Your exam questions and answer fields here */}
        <div className="space-y-6">
          {/* Question components */}
        </div>

        {/* Submit button */}
        <div className="mt-8 flex gap-4">
          <button
            onClick={handleSubmitExam}
            className="flex-1 bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 font-semibold"
          >
            Submit Exam
          </button>
        </div>
      </div>

      {/* Proctoring overlay - handles everything */}
      <ProctoringOverlay
        sessionId={sessionId}
        examId={examId}
        studentId={studentId}
        stream={stream}
        enableAutoStart={true}
        maxFullscreenExits={3}
        onViolation={(event) => {
          console.log('Violation detected:', event.type)
          // Optionally track additional metrics
        }}
        onSessionEnd={(report) => {
          console.log('Proctoring session ended')
          console.log('Total voice time:', report.audio.totalVoiceDuration)
          console.log('Tab switches:', report.windowFocus.focusLossCount)
          console.log('Fullscreen exits:', report.screenLock.exitCount)
        }}
      />
    </div>
  )
}
```

---

## Example 2: Manual Tracker Control (Advanced)

```typescript
// hooks/useAdvancedProctoring.ts
'use client'

import { useEffect, useState, useRef } from 'react'
import KeyboardTracker from '@/proctoring/frontend/KeyboardTracker'
import ClipboardTracker from '@/proctoring/frontend/ClipboardTracker'
import WindowFocusTracker from '@/proctoring/frontend/WindowFocusTracker'
import AudioVAD from '@/proctoring/frontend/AudioVAD'
import ScreenLockEnforcer from '@/proctoring/frontend/ScreenLockEnforcer'
import WebcamCapture from '@/proctoring/frontend/WebcamCapture'

export function useAdvancedProctoring(
  sessionId: string,
  examId: string,
  studentId: string,
  stream: MediaStream
) {
  const [trackerStats, setTrackerStats] = useState<any>(null)
  const trackersRef = useRef<any>({})

  useEffect(() => {
    const initTrackers = async () => {
      try {
        // Initialize each tracker
        trackersRef.current.keyboard = new KeyboardTracker(sessionId, examId, studentId)
        trackersRef.current.clipboard = new ClipboardTracker(sessionId, examId, studentId)
        trackersRef.current.focus = new WindowFocusTracker(sessionId, examId, studentId)
        trackersRef.current.audio = new AudioVAD(sessionId, examId, studentId)
        trackersRef.current.screenLock = new ScreenLockEnforcer(
          sessionId,
          examId,
          studentId,
          (count) => console.log(`Fullscreen exit: ${count}`),
          () => console.log('Exam locked!')
        )
        trackersRef.current.webcam = new WebcamCapture(sessionId, examId, studentId, 30)

        // Start trackers
        trackersRef.current.keyboard.start()
        trackersRef.current.clipboard.start()
        trackersRef.current.focus.start()
        await trackersRef.current.audio.start(stream)
        await trackersRef.current.screenLock.enforce()
        await trackersRef.current.webcam.start(stream)

        console.log('All trackers started')

        // Poll statistics every 5 seconds
        const interval = setInterval(() => {
          setTrackerStats({
            keyboard: trackersRef.current.keyboard.getStats(),
            clipboard: trackersRef.current.clipboard.getStats(),
            focus: trackersRef.current.focus.getStats(),
            audio: trackersRef.current.audio.getStats(),
            screenLock: trackersRef.current.screenLock.getStats(),
            webcam: trackersRef.current.webcam.getStats(),
          })
        }, 5000)

        return () => {
          clearInterval(interval)
        }
      } catch (error) {
        console.error('Failed to init trackers:', error)
      }
    }

    initTrackers()

    return () => {
      // Cleanup
      Object.values(trackersRef.current).forEach((tracker: any) => {
        if (tracker?.stop) tracker.stop()
        if (tracker?.release) tracker.release()
      })
    }
  }, [sessionId, examId, studentId, stream])

  const stopAndGetReport = async () => {
    const report = {
      keyboard: trackersRef.current.keyboard?.getStats(),
      clipboard: trackersRef.current.clipboard?.getStats(),
      focus: trackersRef.current.focus?.getStats(),
      audio: trackersRef.current.audio?.getStats(),
      screenLock: trackersRef.current.screenLock?.getStats(),
      webcam: trackersRef.current.webcam?.getStats(),
    }

    // Clean up
    trackersRef.current.keyboard?.stop()
    trackersRef.current.clipboard?.stop()
    trackersRef.current.focus?.stop()
    trackersRef.current.audio?.stop()
    await trackersRef.current.screenLock?.release()
    await trackersRef.current.webcam?.stop()

    return report
  }

  return {
    trackerStats,
    stopAndGetReport,
  }
}
```

---

## Example 3: Teacher Monitoring Dashboard

```typescript
// components/exam/TeacherMonitor.tsx
'use client'

import { useEffect, useState } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'

interface StudentSession {
  student_id: string
  student_name: string
  flags_count: number
  violations: string[]
  webcam_frames_captured: number
  voice_detected_duration: number
  tab_switches: number
  estimated_risk: 'low' | 'medium' | 'high' | 'critical'
}

export function TeacherMonitor({ examId }: { examId: string }) {
  const [sessions, setSessions] = useState<StudentSession[]>([])
  const supabase = createSupabaseBrowserClient()

  // Subscribe to live flags
  useEffect(() => {
    const channel = supabase
      .channel(`exam-${examId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'flags',
          filter: `exam_id=eq.${examId}`,
        },
        () => {
          // Refetch sessions with updated flags
          refetchSessions()
        }
      )
      .subscribe()

    refetchSessions()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [examId, supabase])

  const refetchSessions = async () => {
    // Fetch all sessions for this exam with their flags
    const response = await fetch(`/api/teacher/exam/${examId}/sessions`)
    const data = await response.json()
    setSessions(data.sessions)
  }

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'low':
        return 'bg-green-50 border-green-200'
      case 'medium':
        return 'bg-yellow-50 border-yellow-200'
      case 'high':
        return 'bg-orange-50 border-orange-200'
      case 'critical':
        return 'bg-red-50 border-red-200'
      default:
        return 'bg-gray-50 border-gray-200'
    }
  }

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-6">Live Exam Monitoring</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sessions.map((session) => (
          <div
            key={session.student_id}
            className={`p-4 border rounded-lg ${getRiskColor(session.estimated_risk)}`}
          >
            <h3 className="font-semibold text-lg">{session.student_name}</h3>

            <div className="mt-4 space-y-2 text-sm">
              <p>
                <span className="text-gray-600">Flags:</span>
                <span className="font-mono ml-2">{session.flags_count}</span>
              </p>
              <p>
                <span className="text-gray-600">Tab Switches:</span>
                <span className="font-mono ml-2">{session.tab_switches}</span>
              </p>
              <p>
                <span className="text-gray-600">Voice Time:</span>
                <span className="font-mono ml-2">
                  {(session.voice_detected_duration / 1000).toFixed(1)}s
                </span>
              </p>
              <p>
                <span className="text-gray-600">Webcam Frames:</span>
                <span className="font-mono ml-2">{session.webcam_frames_captured}</span>
              </p>
            </div>

            {session.violations.length > 0 && (
              <div className="mt-4 pt-4 border-t">
                <p className="text-xs font-semibold text-gray-600 mb-2">Violations:</p>
                <ul className="text-xs space-y-1">
                  {session.violations.slice(0, 3).map((v, i) => (
                    <li key={i} className="text-gray-700">
                      • {v}
                    </li>
                  ))}
                  {session.violations.length > 3 && (
                    <li className="text-gray-500">... +{session.violations.length - 3} more</li>
                  )}
                </ul>
              </div>
            )}

            <button className="mt-4 w-full text-sm bg-blue-600 text-white py-2 rounded hover:bg-blue-700">
              View Full Report
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
```

---

## Example 4: Testing Individual Trackers

```typescript
// test/keyboard-tracker.test.ts
import KeyboardTracker from '@/proctoring/frontend/KeyboardTracker'

describe('KeyboardTracker', () => {
  it('should detect rapid typing bursts', async () => {
    const tracker = new KeyboardTracker('sess-1', 'exam-1', 'stud-1')
    tracker.start()

    // Simulate rapid keystrokes
    for (let i = 0; i < 50; i++) {
      const event = new KeyboardEvent('keydown', {
        key: 'a',
      })
      document.dispatchEvent(event)
    }

    // Wait for window analysis
    await new Promise((resolve) => setTimeout(resolve, 2100))

    const stats = tracker.getStats()
    expect(stats.burstCount).toBeGreaterThan(0)
    expect(stats.suspiciousPatterns.length).toBeGreaterThan(0)

    tracker.stop()
  })
})
```

---

## Example 5: Custom Integration with Backend

```typescript
// lib/proctoring-api.ts
export async function reportCustomViolation(
  sessionId: string,
  examId: string,
  studentId: string,
  violationType: string,
  details: string,
  severity: 'low' | 'medium' | 'high' | 'critical'
) {
  const response = await fetch('/api/flag-event', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      session_id: sessionId,
      exam_id: examId,
      student_id: studentId,
      event_type: violationType,
      flag_type: violationType,
      severity,
      confidence: 0.75,
      metadata: {
        details,
        timestamp: Date.now(),
        source: 'custom_detection',
      },
    }),
  })

  if (!response.ok) {
    throw new Error('Failed to report violation')
  }

  return await response.json()
}

// Usage in exam component
const handleSuspiciousAnswer = async (answer: string) => {
  if (answer.length > 5000) {
    await reportCustomViolation(
      sessionId,
      examId,
      studentId,
      'unusually_long_answer',
      'Answer exceeds typical length',
      'medium'
    )
  }
}
```

---

## Example 6: Multi-Language Exam with Proctoring

```typescript
// components/exam/MultilingualExam.tsx
'use client'

import { useState } from 'react'
import ProctoringSession from '@/proctoring/frontend/ProctoringSession'
import ProctoringOverlay from '@/proctoring/frontend/ProctoringOverlay'

export function MultilingualExam({ examId, sessionId, studentId }: any) {
  const [language, setLanguage] = useState('en')
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [proctoringActive, setProctoringActive] = useState(false)

  // Start proctoring when stream is ready
  const handleStreamReady = async (mediaStream: MediaStream) => {
    setStream(mediaStream)
    setProctoringActive(true)
  }

  return (
    <div className="w-full h-screen flex flex-col">
      {/* Language selector */}
      <div className="bg-gray-100 p-4 border-b">
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          className="px-4 py-2 rounded border"
        >
          <option value="en">English</option>
          <option value="es">Español</option>
          <option value="fr">Français</option>
          <option value="de">Deutsch</option>
          <option value="ja">日本語</option>
          <option value="zh">中文</option>
        </select>
      </div>

      {/* Exam content */}
      <div className="flex-1 overflow-auto p-6">
        {/* Your exam questions in selected language */}
      </div>

      {/* Proctoring UI */}
      {proctoringActive && stream && (
        <ProctoringOverlay
          sessionId={sessionId}
          examId={examId}
          studentId={studentId}
          stream={stream}
          enableAutoStart={true}
        />
      )}
    </div>
  )
}
```

---

## Performance Optimization Tips

### 1. Lazy Load Trackers

```typescript
const trackers = await Promise.all([
  import('@/proctoring/frontend/KeyboardTracker'),
  import('@/proctoring/frontend/ClipboardTracker'),
])
```

### 2. Adjust Capture Intervals Based on Network

```typescript
const webcam = new WebcamCapture(sessionId, examId, studentId)

// Slower network: capture every 60 seconds
if (connection.effectiveType === '3g' || connection.effectiveType === '4g') {
  webcam.setInterval(60)
}

await webcam.start(stream)
```

### 3. Monitor Memory Usage

```typescript
if (performance.memory) {
  const used = performance.memory.usedJSHeapSize
  const limit = performance.memory.jsHeapSizeLimit

  if (used / limit > 0.8) {
    console.warn('High memory usage - consider reducing capture frequency')
  }
}
```

---

## Troubleshooting

### Camera/Microphone Not Detected
```typescript
const devices = await navigator.mediaDevices.enumerateDevices()
const cameras = devices.filter(d => d.kind === 'videoinput')
const mics = devices.filter(d => d.kind === 'audioinput')

console.log(`Found ${cameras.length} cameras and ${mics.length} microphones`)
```

### Fullscreen Not Working in iframe
```typescript
// Requires iframe with allowfullscreen attribute
// <iframe allowfullscreen></iframe>
```

### High CPU Usage
- Reduce webcam capture frequency
- Use lower JPEG quality
- Reduce audio VAD analysis frequency
- Disable unused trackers

---

## See Also

- [Main README](./README.md)
- [API Documentation](./README.md#api-documentation)

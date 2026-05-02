# Proctoring Frontend Module

Complete TypeScript/React implementation of Layer 1 Frontend Capture for the AI-powered online proctoring system.

## Overview

The proctoring frontend module provides real-time monitoring of student behavior during exams through 6 independent trackers coordinated by a central orchestrator:

1. **KeyboardTracker** - Detects typing anomalies and paste-as-typing
2. **ClipboardTracker** - Monitors copy/paste events
3. **WindowFocusTracker** - Tracks tab switches and window focus loss
4. **ScreenLockEnforcer** - Enforces and maintains fullscreen mode
5. **WebcamCapture** - Captures and uploads video frames
6. **AudioVAD** - Detects voice activity during exam
7. **ProctoringSession** - Orchestrates all trackers
8. **ProctoringOverlay** - React UI component for student-facing display

## Installation

All files are TypeScript and can be imported directly:

```bash
# No additional dependencies required
# Uses browser APIs and existing face-api.js installation
```

## Quick Start

### Basic Usage with ProctoringSession

```typescript
import ProctoringSession from '@/proctoring/frontend/ProctoringSession'

// In your exam component:
const handleExamStart = async () => {
  // Get media stream (camera + microphone)
  const stream = await navigator.mediaDevices.getUserMedia({
    video: true,
    audio: true,
  })

  // Create proctoring session
  const session = new ProctoringSession({
    sessionId: examSession.id,
    examId: exam.id,
    studentId: user.id,
    stream,
    onWarning: (count) => {
      console.log(`Warning ${count}/3 - suspicious activity detected`)
    },
    onLock: () => {
      console.log('Exam locked due to violations')
    },
    maxScreenLockExits: 3,
    heartbeatInterval: 30, // seconds
  })

  // Start proctoring
  await session.start()

  // Listen for flag events
  session.on((event) => {
    console.log('Flag event:', event)
  })
}

// When exam is submitted:
const handleExamSubmit = async () => {
  const report = await session.stop()
  
  // Report now contains all tracking data:
  // report.keyboard, report.clipboard, report.windowFocus,
  // report.screenLock, report.webcam, report.audio
}
```

### Using with ProctoringOverlay Component

```typescript
import ProctoringOverlay from '@/proctoring/frontend/ProctoringOverlay'

export function ExamPage() {
  const [stream, setStream] = useState<MediaStream | null>(null)

  useEffect(() => {
    const getStream = async () => {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      })
      setStream(mediaStream)
    }
    getStream()
  }, [])

  if (!stream) return <div>Requesting permissions...</div>

  return (
    <div>
      {/* Your exam UI */}
      <ExamContent />

      {/* Proctoring overlay - handles everything automatically */}
      <ProctoringOverlay
        sessionId={sessionId}
        examId={examId}
        studentId={studentId}
        stream={stream}
        enableAutoStart={true}
        maxFullscreenExits={3}
        onViolation={(event) => {
          console.log('Violation:', event)
        }}
        onSessionEnd={(report) => {
          console.log('Session ended:', report)
        }}
      />
    </div>
  )
}
```

## API Documentation

### KeyboardTracker

Detects keystroke anomalies including typing bursts (paste-as-typing) and unnatural typing patterns.

```typescript
import KeyboardTracker from '@/proctoring/frontend/KeyboardTracker'

const tracker = new KeyboardTracker(sessionId, examId, studentId)

tracker.start()

// Get statistics
const stats = tracker.getStats()
// Returns: {
//   totalKeystrokes: 150,
//   avgTimeBetweenKeys: 87, // ms
//   burstCount: 2,
//   suspiciousPatterns: [{ type, timestamp, details, severity }],
//   maxCharsPerSecond: 12.5,
//   minCharsPerSecond: 1.2
// }

tracker.stop()
```

**Events Posted to Backend:**
- Type: `keyboard_anomaly`
- Severity: `medium` | `high`
- Metadata: `{ pattern_type, details }`

---

### ClipboardTracker

Monitors copy, cut, and paste events. Flags large pastes that indicate answer copying.

```typescript
import ClipboardTracker from '@/proctoring/frontend/ClipboardTracker'

const tracker = new ClipboardTracker(sessionId, examId, studentId)

tracker.start()

// Get all events
const events = tracker.getEvents()
// Returns: [{ type: 'copy'|'cut'|'paste', timestamp, charCount?, ... }]

// Get statistics
const stats = tracker.getStats()
// Returns: {
//   totalEvents: 5,
//   copyCount: 2,
//   cutCount: 0,
//   pasteCount: 3,
//   largePasteCount: 1,
//   events: [],
//   suspiciousPatterns: []
// }

// Check for early large pastes
if (tracker.hasSuspiciousEarlyPaste()) {
  console.log('Student pasted large content in first 60 seconds')
}

tracker.stop()
```

**Configuration:**
- Large paste threshold: 50 characters
- Percentage threshold: 30% of answer length

**Events Posted to Backend:**
- Type: `clipboard_paste`
- Severity: `high`
- Metadata: `{ char_count, percentage_of_total, reason }`

---

### WindowFocusTracker

Tracks tab switches and window focus loss.

```typescript
import WindowFocusTracker from '@/proctoring/frontend/WindowFocusTracker'

const tracker = new WindowFocusTracker(sessionId, examId, studentId)

tracker.start()

// Check current focus
const isFocused = tracker.isFocused() // boolean

// Get statistics
const stats = tracker.getStats()
// Returns: {
//   focusLossCount: 2,
//   totalTimeOutOfFocus: 5000, // ms
//   focusRegainCount: 2,
//   totalFocusTime: 295000,
//   longestFocusLoss: 3000,
//   events: [{ type, timestamp, duration? }]
// }

tracker.stop()
```

**Events Posted to Backend:**
- Type: `tab_hidden`, `tab_visible`, `blur`, `focus`
- Flag Type: `tab_switch`
- Severity: `medium`
- Confidence: `0.95`

---

### ScreenLockEnforcer

Enforces fullscreen mode and tracks fullscreen exit attempts.

```typescript
import ScreenLockEnforcer from '@/proctoring/frontend/ScreenLockEnforcer'

const enforcer = new ScreenLockEnforcer(
  sessionId,
  examId,
  studentId,
  (exitCount) => console.log(`Fullscreen exit #${exitCount}`),
  () => console.log('Exam locked!'),
  3 // max exits
)

// Enforce fullscreen
await enforcer.enforce()

// Get exit count
const exitCount = enforcer.getExitCount()

// Get statistics
const stats = enforcer.getStats()
// Returns: {
//   exitCount: 0,
//   isFullscreenActive: true,
//   lastExitTime: null,
//   exitAttempts: []
// }

// Release fullscreen
await enforcer.release()
```

**Events Posted to Backend:**
- `fullscreen_exit`: Type, Severity: `high`
- `exam_locked_fullscreen`: Type, Severity: `critical`
- Metadata: `{ exit_count, max_exits, timestamp }`

---

### WebcamCapture

Captures video frames and uploads to backend at regular intervals.

```typescript
import WebcamCapture from '@/proctoring/frontend/WebcamCapture'

const capture = new WebcamCapture(
  sessionId,
  examId,
  studentId,
  30 // capture every 30 seconds
)

// Get media stream
const stream = await navigator.mediaDevices.getUserMedia({ video: true })

// Start capturing
await capture.start(stream)

// Get statistics
const stats = capture.getStats()
// Returns: {
//   framesCaptured: 5,
//   framesUploaded: 5,
//   failedUploads: 0,
//   lastCaptureTime: 1714682340000,
//   lastUploadTime: 1714682340500
// }

// Adjust settings
capture.setJpegQuality(0.5) // 0-1
capture.setInterval(60) // seconds

// Stop capturing
await capture.stop()
```

**API Endpoint:**
- POST `/api/proctor/face-frame`
- Body: `{ session_id, exam_id, student_id, timestamp, frame_b64, frame_index }`

---

### AudioVAD (Voice Activity Detection)

Detects sustained voice activity indicating unauthorized talking.

```typescript
import AudioVAD from '@/proctoring/frontend/AudioVAD'

const vad = new AudioVAD(
  sessionId,
  examId,
  studentId,
  0.02, // RMS threshold
  1500 // 1.5 seconds before flagging
)

// Get media stream with audio
const stream = await navigator.mediaDevices.getUserMedia({ audio: true })

// Start listening
await vad.start(stream)

// Check if voice is currently detected
const speaking = vad.isVoiceActive()

// Get voice activity ratio
const voiceRatio = vad.getVoiceRatio() // 0-1

// Get statistics
const stats = vad.getStats()
// Returns: {
//   isListening: true,
//   voiceDetectedCount: 1,
//   totalVoiceDuration: 2500,
//   voiceRatio: 0.05,
//   currentlyDetected: false,
//   events: [{ startTime, endTime, duration, peakRMS }]
// }

// Adjust sensitivity
vad.setVoiceThreshold(0.015) // More sensitive
vad.setSustainedDuration(1000) // Lower threshold

// Stop listening
await vad.stop()
```

**Events Posted to Backend:**
- Type: `voice_detected`
- Severity: `medium`
- Metadata: `{ duration_ms, threshold_ms, timestamp }`

---

### ProctoringSession (Orchestrator)

Master controller that manages all trackers and sends heartbeats.

```typescript
import ProctoringSession from '@/proctoring/frontend/ProctoringSession'

const session = new ProctoringSession({
  sessionId: 'sess-123',
  examId: 'exam-456',
  studentId: 'student-789',
  stream: mediaStream,
  onWarning: (count) => console.log(`Warning ${count}`),
  onLock: () => console.log('Locked'),
  enableKeyboardTracking: true,
  enableClipboardTracking: true,
  enableWindowFocusTracking: true,
  enableScreenLock: true,
  enableWebcamCapture: true,
  enableAudioVAD: true,
  webcamCaptureInterval: 30,
  heartbeatInterval: 30,
  maxScreenLockExits: 3,
})

// Start all trackers
await session.start()

// Listen for flag events
session.on((event) => {
  console.log('Flag:', event.type, event.severity)
})

// Get live summary
const report = session.getSessionSummary()
// Returns: {
//   keyboard: KeyboardStats,
//   clipboard: ClipboardStats,
//   windowFocus: WindowFocusStats,
//   screenLock: ScreenLockStats,
//   webcam: FrameCaptureStats,
//   audio: AudioVADStats,
//   sessionDuration: 300000,
//   startTime: 1714682340000
// }

// Stop and get final report
const finalReport = await session.stop()
// Also sends POST to /api/proctor/session-end
```

**Heartbeat Endpoint:**
- POST `/api/proctor/heartbeat` every 30 seconds
- Body: `{ session_id, exam_id, student_id, timestamp, stats: {...} }`

**Session End Endpoint:**
- POST `/api/proctor/session-end`
- Body: `{ session_id, exam_id, student_id, timestamp, session_log: ProctoringReport }`

---

### ProctoringOverlay (React Component)

Full-screen React component that displays status bar, webcam thumbnail, and warning modals.

```typescript
import ProctoringOverlay from '@/proctoring/frontend/ProctoringOverlay'

<ProctoringOverlay
  sessionId="sess-123"
  examId="exam-456"
  studentId="student-789"
  stream={mediaStream}
  enableAutoStart={true}
  maxFullscreenExits={3}
  onViolation={(event) => {
    console.log('Violation:', event)
  }}
  onSessionEnd={(report) => {
    console.log('Report:', report)
  }}
/>
```

**Features:**
- Top status bar showing: Proctoring status, Face detection, Voice activity, Fullscreen mode
- Live webcam thumbnail (120x90px)
- Auto-dismissing warning modals (5 seconds)
- Lock screen overlay for critical violations
- Automatically manages ProctoringSession lifecycle

---

## Backend API Contract

### Required Endpoints

All trackers POST to these endpoints. Ensure they exist:

**POST /api/flag-event**
```json
{
  "session_id": "string",
  "exam_id": "string",
  "student_id": "string",
  "event_type": "string",
  "flag_type": "string",
  "severity": "low|medium|high|critical",
  "confidence": 0.0-1.0,
  "metadata": { ... }
}
```

**POST /api/proctor/face-frame**
```json
{
  "session_id": "string",
  "exam_id": "string",
  "student_id": "string",
  "timestamp": number,
  "frame_b64": "data:image/jpeg;base64,...",
  "frame_index": number
}
```

**POST /api/proctor/heartbeat**
```json
{
  "session_id": "string",
  "exam_id": "string",
  "student_id": "string",
  "timestamp": number,
  "stats": {
    "keyboard": KeyboardStats,
    "clipboard": ClipboardStats,
    "window_focus": WindowFocusStats,
    "screen_lock": ScreenLockStats,
    "webcam": FrameCaptureStats,
    "audio": AudioVADStats,
    "session_duration_ms": number
  }
}
```

**POST /api/proctor/session-end**
```json
{
  "session_id": "string",
  "exam_id": "string",
  "student_id": "string",
  "timestamp": number,
  "session_log": ProctoringReport
}
```

---

## Browser Compatibility

- Chrome/Edge 90+
- Firefox 88+
- Safari 15+

**Features Used:**
- MediaDevices API (camera/microphone)
- Web Audio API (voice detection)
- Fullscreen API
- Clipboard API
- VisibilityChange API

---

## Performance Considerations

- Keyboard tracking: ~1% CPU (event-based)
- Clipboard tracking: Negligible (event-based)
- Focus tracking: Negligible (event-based)
- Screen lock: ~2% CPU (browser-native)
- Webcam capture: ~5-10% CPU (frame encoding to JPEG)
- Audio VAD: ~3-5% CPU (frequency analysis)
- **Total: ~10-20% CPU** during active exam

---

## Error Handling

All trackers handle errors gracefully:

```typescript
try {
  await session.start()
} catch (error) {
  if (error.name === 'NotAllowedError') {
    // User denied permissions
  } else if (error.name === 'NotFoundError') {
    // Camera/microphone not found
  } else {
    // Other error
  }
}
```

---

## Privacy & Security Notes

- ✅ Frame captures are sent as JPEG (not stored locally)
- ✅ Audio RMS only (no audio content stored or transmitted)
- ✅ Keystroke types only (not key values - privacy-preserving)
- ✅ All events timestamped and signed by server
- ⚠️ Ensure HTTPS for all data transmission
- ⚠️ Implement rate limiting on backend endpoints

---

## Testing

Each tracker can be tested independently:

```typescript
// Test keyboard tracker
const kb = new KeyboardTracker('sess-1', 'exam-1', 'stud-1')
kb.start()
// Type something...
const stats = kb.getStats()
console.log(stats)
kb.stop()
```

---

## License

Part of the Online Proctor System. See LICENSE file.

# WEBCAM RELIABILITY & EXAM MONITORING IMPROVEMENTS

**Project:** Online Proctoring System  
**Status:** Phase 1 Complete, Starting Webcam Reliability Improvements  
**Current Date:** March 18, 2026  

---

## 🎯 COMPREHENSIVE TASK OVERVIEW

Build robust webcam handling and exam behavioral monitoring. The system has multiple issues with webcam initialization, face detection, and behavioral event tracking that need systematic fixes.

---

## 📋 ISSUES TO FIX (IN ORDER)

### **ISSUE #1: Webcam Race Condition & Unreliability**

**Problem:**
- `ExamTaker.tsx` has TWO separate video refs (`webcamVideoRef` and `videoRef`) trying to access camera independently
- `webcamVideoRef` for display, `videoRef` for face detection
- Causes race conditions, duplicate getUserMedia requests, and silent failures
- No retry mechanism when camera fails
- No permission state management

**Current Code Location:** `src/components/student/ExamTaker.tsx` lines 139-177

**What Needs to Be Done:**

#### **TASK 1A: Create `src/hooks/useWebcam.ts` Hook**

Custom hook with:
- **State Machine:** `'idle' → 'requesting' → 'active' | 'denied' | 'error' | 'retrying'`
- **On Mount:** Call `navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480, facingMode: 'user' }, audio: true })`
- **Error Handling:**
  - `NotAllowedError` or `PermissionDeniedError` → set state to `'denied'`
  - Other errors → set state to `'error'`
- **Retry Function:** `retryWebcam()` that stops existing tracks, resets state to `'requesting'`, tries again
- **Auto-Cleanup:** On unmount, stop all tracks: `stream.getTracks().forEach(t => t.stop())`
- **Return Object:** `{ videoRef, streamRef, webcamStatus, retryWebcam }`

#### **TASK 1B: Create `src/components/exam/WebcamView.tsx` Component**

Standalone component that displays webcam with proper UX:
- **Requesting/Retrying State:** Show loading spinner
- **Denied State:** Red card with browser-specific instructions
  - Chrome: "Click lock icon → Site Settings → Camera → Allow"
  - Firefox: "Click Permissions → Toggle Camera → Allow"
  - Include Retry button
- **Error State:** Orange card with troubleshooting steps + Retry button
- **Active State:** `<video>` with mirror effect (`transform: scaleX(-1)`)
- **Status Ring:** Color around video
  - Green = safe (`riskLevel='safe'`)
  - Yellow = warning (`riskLevel='warning'`)
  - Red = alert (`riskLevel='alert'`)
- **Minimize Button:** Collapses to small pill (64×64) in corner, expands back on click
- **Prop:** `riskLevel?: 'safe' | 'warning' | 'alert'`

#### **TASK 1C: Refactor `src/components/student/ExamTaker.tsx`**

- Remove `videoRef` entirely (was only for face detection backup)
- Remove `webcamError` state, `webcamReady` state
- Add: `const { videoRef: webcamVideoRef, streamRef, webcamStatus, retryWebcam } = useWebcam();`
- Update webcam panel to show different UIs based on `webcamStatus`:
  - Spinner for `'requesting'` / `'retrying'`
  - Red error + Retry for `'denied'`
  - Orange error + Retry for `'error'`
  - Video element for `'active'`
- Face detection should only use `webcamVideoRef` (not fallback to hidden video)
- Add guard in `runFaceDetection()`: `if (video.readyState < 2) return;`

---

### **ISSUE #2: Face Detection Failing Even With Face Present**

**Problem:**
- Console shows: `[No Face Detected] 5 times in a row` → 50+ times continuously
- Even though user's face is clearly in front of camera
- Face-api not detecting any faces in environment

**Root Causes:**
1. Video element might not have frame data ready
2. Face-api models not fully loaded when detection starts
3. Video dimensions might be 0
4. Need more robust face detector (SSD MobileNet as primary)

**Current Code Location:** `src/components/student/ExamTaker.tsx` lines 223-285

**What Needs to Be Done:**

#### **TASK 2A: Enhance Face Detection Initialization**

In `useEffect` for face detection:
- Load SSD MobileNet in addition to TinyFaceDetector
- Add logging: `console.log('✓ Face-api models loaded successfully');`
- Add logging: `console.log('[Face Detection Init] SSD loaded:', faceapi.nets.ssdMobilenetv1.isLoaded());`
- Only start detection interval when `webcamStatus === 'active'`
- Only start if `exam.eye_tracking_enabled` OR `exam.phone_detection_enabled` is true

#### **TASK 2B: Enhance `runFaceDetection()` Function**

```typescript
const runFaceDetection = async () => {
  const video = webcamVideoRef.current;
  if (!video || !faceApiLoaded) return;
  
  // Guard 1: readyState check
  if (video.readyState < 2) return;
  
  // Guard 2: video dimensions check (NEW)
  if (!video.videoWidth || !video.videoHeight) return;
  
  try {
    // Primary: SSD MobileNet
    let detections;
    try {
      detections = await faceapi
        .detectAllFaces(video, new faceapi.SsdMobilenetv1Options())
        .withFaceLandmarks()
        .withFaceDescriptors();
    } catch {
      // Fallback: TinyFaceDetector
      detections = await faceapi
        .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks();
    }
    
    console.log(`[Face Detection] Found ${detections.length} face(s)`);
    
    // ... rest of detection logic
  }
};
```

- Change warning frequency from every 3x → every 5x (~15 seconds instead of ~9)
- Add auto-reset: when face is detected, reset `noFaceCount` to 0 immediately
- Don't set warning if one already showing (prevents spam)
- Add console logging for video readyState, dimensions, detection results

---

### **ISSUE #3: Warnings Auto-Closing & Behavior Events Not Logging**

**Problem:**
- Warning overlay shows for behavioral events but auto-closes
- User clicks "I Understand" but warnings keep firing every 15 seconds
- Tab switch, fullscreen exit, copy-paste events not logging to console
- No way to know what's being monitored

**What Needs to Be Done:**

#### **TASK 3A: Improve Tab Switch Detection**

In `useEffect` for tab switch:
```typescript
const handleVisibilityChange = () => {
  if (document.hidden) {
    setTabSwitchCount((prev) => {
      const newCount = prev + 1;
      console.warn(`[Tab Switch Detected] Count: ${newCount}/${exam.max_tab_switches}`);
      logBehaviorEvent('tab_switch', 0.95, { count: newCount });
      
      if (newCount >= exam.max_tab_switches) {
        setShowWarning(`🚨 WARNING! You have switched tabs ${newCount} times. Exam may be auto-submitted.`);
      } else {
        if (!showWarning) { // Only show if no warning
          setShowWarning(`⚠️ Tab switch detected! (${newCount}/${exam.max_tab_switches} allowed)`);
        }
      }
      return newCount;
    });
  } else {
    console.log('[Tab Switch] User returned to tab');
  }
};
```

#### **TASK 3B: Improve Fullscreen Exit Detection**

Add logging:
```typescript
const handleFullscreenChange = () => {
  if (!document.fullscreenElement) {
    console.warn('[Fullscreen Exit] User exited fullscreen');
    logBehaviorEvent('fullscreen_exit', 0.9, {});
    if (!showWarning) {
      setShowWarning('⚠️ You exited fullscreen! Attempting to re-enter...');
    }
    document.documentElement.requestFullscreen().catch((err) => {
      console.error('[Fullscreen] Failed to re-enter:', err);
    });
  }
};
```

#### **TASK 3C: Add Monitoring Status Bar**

In top bar of exam, add badges showing what's active:
```
📹 Webcam  |  🖥️ Fullscreen  |  👁️ Detection ✓  |  ⚠️ Tab: 1/3
```

Shows:
- 📹 Webcam (if `exam.webcam_required`)
- 🖥️ Fullscreen (if `exam.fullscreen_required`)
- 👁️ Detection with ✓ or ... status (if `eye_tracking_enabled` OR `phone_detection_enabled`)
- ⚠️ Tab switches (N/MAX) - only show if > 0

#### **TASK 3D: Improve Warning Modal**

- Add emoji prefix to all warnings
- Add "Debug" button that logs current counter values to console
- Only show warning if no warning already visible (prevent spam from multiple events)

---

### **ISSUE #4: Copy-Paste Prevention Not All Working**

**Current:**
- Copy event logging works
- Paste event prevention works but might need better logging

**Enhancement:**
- Add console logging for copy-paste events
- Show warning with emoji: `⚠️ Copy-paste is not allowed during exam!`
- Log to console: `[Copy Attempt]` or `[Paste Blocked]`

---

## 🔧 FILES TO MODIFY/CREATE

### **Create (New Files):**
1. `src/hooks/useWebcam.ts` - Custom hook for webcam state management
2. `src/components/exam/WebcamView.tsx` - Standalone webcam display component

### **Modify (Existing Files):**
1. `src/components/student/ExamTaker.tsx` - Integrate useWebcam hook, enhance face detection, improve logging

---

## 📊 SUPABASE DATABASE SCHEMA (Reference)

```sql
-- exams table has these columns relevant to monitoring:
- webcam_required: boolean
- fullscreen_required: boolean
- eye_tracking_enabled: boolean
- phone_detection_enabled: boolean
- max_tab_switches: integer
- max_face_away_events: integer (not used yet)

-- exam_sessions tracks:
- id: UUID
- student_id: UUID
- status: 'in_progress' | 'submitted'
- cheating_score: float (currently 0, needs calculation)

-- flags table records:
- session_id: UUID
- student_id: UUID
- flag_type: 'tab_switch' | 'fullscreen_exit' | 'copy_paste' | 'no_face' | 'multiple_faces' | 'eye_away' | 'copy_attempt'
- severity: 'low' | 'medium' | 'high' | 'critical'

-- behavior_logs table records:
- session_id: UUID
- student_id: UUID
- event_type: same as flag_type
- confidence: float (0-1)
```

---

## ⚙️ CRITICAL RULES TO FOLLOW

1. **Always use `supabase.rpc()`** - Never use `supabase.from()`
2. **RLS is DISABLED** - Don't enable it
3. **Server client:** `createSupabaseServerClient()` from `@/lib/supabase/server`
4. **Browser client:** `createSupabaseBrowserClient()` from `@/lib/supabase/client`
5. **useWebcam hook must NOT depend on webcam being required** - Always initialize
6. **Face detection runs ONLY if** `exam.eye_tracking_enabled` OR `exam.phone_detection_enabled`
7. **All event logging** should use `logBehaviorEvent()` function in ExamTaker

---

## 🧪 HOW TO TEST

### **Test Scenario 1: Webcam Permission Denied**
1. Start exam in browser where you haven't granted camera permission
2. Should see red card with instructions
3. Deny permission in browser
4. Should show: `⚠️ Camera access denied`
5. Click Retry → should try again
6. Check console: `[useWebcam] ✗ Camera error: NotAllowedError`

### **Test Scenario 2: Webcam Active**
1. Grant camera permission
2. Should see loading spinner briefly
3. Then video feed appears
4. Console shows: `[useWebcam] ✓ Camera access granted, status → active`
5. If eye_tracking enabled, console shows: `[Face Detection] Found 1 face(s)`

### **Test Scenario 3: No Face Detected**
1. Take exam with face visible
2. Console should show: `[Face Detection] Found 1 face(s)` every 3 seconds
3. If NOT detecting, check:
   - Video console logs for readyState and dimensions
   - Check exam settings: is eye_tracking or phone_detection enabled?
   - Check browser: is face-api getting enough light?

### **Test Scenario 4: Tab Switch**
1. Take exam, stay on tab 1
2. Click to different browser tab
3. Should see warning: `⚠️ Tab switch detected! (1/X allowed)`
4. Console shows: `[Tab Switch Detected] Count: 1/X`
5. Click "I Understand" to dismiss
6. Warning auto-closes but doesn't spam if you return immediately
7. Check logs: flag and behavior_log created in Supabase

### **Test Scenario 5: Fullscreen Exit**
1. Exam should start in fullscreen (if required)
2. Press Escape or exit fullscreen
3. Should see warning: `⚠️ You exited fullscreen!`
4. Console shows: `[Fullscreen Exit] User exited fullscreen`
5. Should auto-re-enter fullscreen
6. Check Supabase for fullscreen_exit flag

---

## 📌 DELIVERABLES

When complete, the system should have:

✅ **useWebcam Hook:**
- State machine for webcam initialization
- Permission handling (denied vs error)
- Retry mechanism
- Auto-cleanup

✅ **WebcamView Component:**
- All 6 states properly handled
- Loading spinner
- Permission denied UX
- Error UX
- Live video feed
- Minimize functionality

✅ **Enhanced ExamTaker:**
- Uses useWebcam hook exclusively
- Robust face detection with SSD MobileNet primary + TinyFace fallback
- Comprehensive console logging for debugging
- Tab switch detection with counter
- Fullscreen exit detection
- Copy-paste prevention
- Status indicator bar showing what's monitored
- Warning modal that doesn't spam

✅ **Console Logging:**
- All behavioral events logged with `[EventType]` prefix
- Face detection diagnostics
- Webcam initialization flow
- Video element state information

---

## 🚀 IMPLEMENTATION NOTES

- **Start with useWebcam hook** - it's the foundation
- **Then WebcamView component** - self-contained, can test separately
- **Then ExamTaker refactoring** - integrate hook, enhance face detection, add logging
- **Test each step** - check console logs for diagnostics
- **Don't break existing functionality** - auth, exam creation, question handling should all still work

---

## 📞 COMMON ISSUES & SOLUTIONS

**Issue:** Console shows `[Face Detection] Found 0 face(s)` even with face visible
- **Solution:** Check if `eye_tracking_enabled` is true in exam settings. If false, detection won't run.
- **Solution 2:** Check video console logs for readyState warnings. Video might not be ready.
- **Solution 3:** Lighting might be too dark. Try increasing room brightness.

**Issue:** Warnings keep appearing every 15 seconds
- **Solution:** Warning system now checks if one already showing. This should prevent spam.
- **Solution 2:** Use Debug button to see exact counter values. Might be multiple events triggering.

**Issue:** Tab switch not logging
- **Solution:** Check console for `[Tab Switch Detected]` logs
- **Solution 2:** Verify `exam.max_tab_switches` is > 0 (if 0, tab switching might be unlimited)
- **Solution 3:** Check Supabase - should see new flags and behavior_logs in DB

**Issue:** Webcam stays blank/spinning
- **Solution:** Check console for `[useWebcam]` logs. Should show either success or specific error.
- **Solution 2:** Verify camera permissions in browser settings
- **Solution 3:** Check if another app is using camera

---

## ✨ READY TO START!

Copy this entire prompt and paste it in a **NEW CHAT** to get a fresh start with full context on:
1. All issues to fix
2. Exact implementation requirements
3. File locations and code examples
4. Testing scenarios
5. Troubleshooting guide

---

**Last Updated:** March 18, 2026  
**Status:** Ready for implementation

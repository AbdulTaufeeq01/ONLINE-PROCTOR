# AI Proctoring System - Implementation Status

**Date**: May 2, 2026  
**Project**: Online Proctor App  
**Current Implementation**: 40% complete

---

## SUMMARY

This document maps the requested AI Online Proctoring System (4-layer architecture) against the existing codebase. The project has a solid foundation with most backend infrastructure in place, but is missing the modular frontend capture system and the comprehensive risk aggregation system.

---

## LAYER 1: FRONTEND CAPTURE MODULES

### ✅ IMPLEMENTED (Partial)

| Component | Status | Location | Notes |
|-----------|--------|----------|-------|
| **Tab/Window Focus Tracking** | ✅ Implemented | `useProctoring.ts` | Detects tab switches & window blur via `visibilitychange`, `blur` events |
| **Copy-Paste Detection** | ✅ Implemented | `useProctoring.ts` | Detects copy/paste/context menu events, posts to `/api/flag-event` |
| **Face Detection** | ✅ Implemented | `useProctoring.ts` | Uses face-api.js (TinyFaceDetector) to detect 0, 1, or multiple faces |
| **Noise Detection (VAD)** | ✅ Implemented | `useNoiseDetection.ts` | Detects loud sounds & voice activity via Web Audio API RMS analysis |
| **Webcam Access Control** | ✅ Implemented | `useWebcam.ts` | Requests camera permission, manages MediaStream, handles errors |
| **Face Models** | ✅ Available | `/public/models/` | Face landmark, detection, age/gender, expression models present |

### ❌ NOT IMPLEMENTED (Not As Standalone Modules)

| Component | Status | Why | Impact |
|-----------|--------|-----|--------|
| **KeyboardTracker.js** | ❌ Missing | No keystroke timing/burst detection | Cannot detect paste-as-typing or unnatural typing patterns |
| **ClipboardTracker.js** | ❌ Missing (partial) | No dedicated clipboard module | Paste detection exists but lacks size analysis vs answer length |
| **WindowFocusTracker.js** | ❌ Missing (partial) | Merged into useProctoring | No separate module; tracking is inline |
| **ScreenLockEnforcer.js** | ❌ Missing | No fullscreen enforcement | Cannot force fullscreen or count fullscreen exits |
| **WebcamCapture.js** | ❌ Missing (partial) | No frame capture to base64 + POST loop | No periodic frame upload to backend |
| **AudioVAD.js** | ❌ Missing (partial) | Basic VAD in useNoiseDetection | No proper Voice Activity Detection; just RMS-based sound detection |
| **ProctoringSession.js** | ❌ Missing | No orchestrator class | Cannot start/stop all trackers together with synchronized heartbeats |
| **ProctoringOverlay.jsx** | ❌ Missing | No exam UI overlay component | No status bar, webcam thumbnail, or warning modal shown to student |

---

## LAYER 2: AI DETECTION MODULES (BACKEND)

### ✅ IMPLEMENTED (TypeScript/Next.js, not Python)

| Module | Status | Location | Functionality |
|--------|--------|----------|---|
| **AI Detection Engine** | ✅ Implemented | `lib/ai-detection.ts` | Uses Gemini 2.5-flash to score AI-written content per question (0-100) |
| **Semantic Similarity** | ✅ Implemented | `lib/semantic-similarity.ts` | Uses Gemini text-embedding-004 to compare answer vectors (plagiarism detection) |
| **Behavioral Analyzer** | ✅ Implemented | `app/api/analyze-behavior/route.ts` | Computes behavioral risk score from flags & behavior logs |
| **Grading System** | ✅ Implemented | `app/api/grade-answers/route.ts` + `lib/grading.ts` | Grades MCQ/short/long answers with Gemini + normalized abbreviations |

### ❌ NOT IMPLEMENTED (As Requested Python Modules)

| Module | Why Missing | Impact |
|--------|------------|--------|
| **face_analyzer.py** | No deepface integration | Cannot analyze webcam frames for face count, gaze, liveness, emotion |
| **audio_analyzer.py** | No dedicated module | Cannot aggregate voice events into speech ratio analysis |
| **screen_analyzer.py** | No screen capture/Claude Vision API | Cannot detect AI assistants, search engines, or cheating apps in screenshots |
| **similarity_engine.py** | Implemented in TypeScript | Works but not as standalone Python module |
| **risk_aggregator.py** | No weighted score combination | Cannot combine all 5 modules into single 0-100 risk score |

---

## LAYER 3: RISK SCORE AGGREGATION & ACTIONS

### ✅ IMPLEMENTED

| Feature | Location | Details |
|---------|----------|---------|
| **Flag Logging** | `api/flag-event/route.ts` | All events logged to `flags` & `behavior_logs` tables |
| **Behavior Risk Score** | `api/analyze-behavior/route.ts` | Computes weighted score from flag severities |
| **Semantic Similarity** | `api/detect-collusion/route.ts` | Detects high-similarity answer pairs between students |
| **AI Detection Score** | `api/grade-answers/route.ts` | Per-question AI score (0-100) |
| **Exam Session Tracking** | Supabase `exam_sessions` table | Stores session metadata, scores, flags |

### ❌ NOT IMPLEMENTED

| Feature | Why Missing | Impact |
|---------|------------|--------|
| **Unified Risk Score (0-100)** | No aggregator module | Cannot produce single composite score from 5 sources |
| **Risk Level Thresholds** | Not defined | No automatic "safe/review/suspicious/high_risk" classification |
| **Weighted Module Combination** | No aggregator | Behavioral: 25%, Plagiarism: 30%, Face: 20%, Audio: 10%, Screen: 15% weights NOT applied |
| **Auto-Triggered Actions** | No action mapper | Cannot auto-warn students, pause exams, or lock sessions based on thresholds |
| **Live Heartbeat System** | No periodic heartbeat endpoint | Cannot send live risk updates to student every 30 seconds |

---

## LAYER 4: TEACHER DASHBOARD & REPORTING

### ✅ IMPLEMENTED

| Feature | Location | Status |
|---------|----------|--------|
| **Exam Report Page** | `components/exam/ExamReport.tsx` | Shows flags, questions, student answers, grading |
| **Flag Visualization** | `components/exam/FlagBadge.tsx` | Displays flag badges with severity colors |
| **Exam Monitor** | `components/exam/ExamMonitor.tsx` | Lists students during live exam |
| **Noise Warning Modal** | `components/exam/NoiseWarning.tsx` | Shows warning count & remaining warnings |
| **Real-time Flag Subscription** | `hooks/useRealtimeFlags.ts` | Subscribes to new flags via Supabase real-time |
| **Teacher Monitor Route** | `app/teacher/exam/[id]/monitor/page.tsx` | Monitor page exists |
| **Teacher Report Route** | `app/teacher/exam/[id]/report/page.tsx` | Report page exists |

### ❌ NOT IMPLEMENTED

| Feature | Why Missing | Impact |
|---------|------------|--------|
| **ProctorDashboard.jsx** | Not created | No teacher dashboard showing all students risk scores, risk breakdown radar chart, webcam thumbnails, timeline |
| **Risk Score Summary Card** | Not in dashboard | Cannot show flagged count by risk level (safe/review/suspicious/high_risk) |
| **Student Risk Table** | Exists but incomplete | Cannot sort by risk score, view webcam captures, or trigger teacher actions |
| **Score Breakdown Visualization** | Missing | No radar chart showing behavior/plagiarism/face/audio/screen scores |
| **Webcam Snapshot Grid** | Missing | Cannot view captured face frames with analysis labels |
| **Teacher Review Actions** | Missing | No "Mark as Cleared / Confirm Cheating / Needs Investigation" buttons |
| **Teacher Verdict Logging** | Partial | No POST `/api/proctor/teacher-review/{report_id}` endpoint |
| **PDF Export** | Missing | Cannot export flagged students as PDF summary report |

---

## API ENDPOINTS

### ✅ IMPLEMENTED

```
POST /api/flag-event
  → Logs flags and behavior events to Supabase
  
POST /api/analyze-behavior
  → Computes behavioral risk from session flags
  
POST /api/detect-collusion
  → Detects similar answers between students
  
POST /api/grade-answers
  → Grades subjective answers with Gemini
  
POST /api/generate-report
  → Generates exam report (may be incomplete)
```

### ❌ NOT IMPLEMENTED

```
POST /api/proctor/session-start
  → Initialize proctoring session with config
  
POST /api/proctor/face-frame
  → Upload webcam frame for face analysis
  
POST /api/proctor/voice-event
  → Log voice activity detection event
  
POST /api/proctor/screen-frame
  → Upload screenshot for screen analysis
  
POST /api/proctor/heartbeat
  → Send live tracker summaries & receive risk updates
  
POST /api/proctor/session-end
  → End session & trigger full analysis
  
GET /api/proctor/report/{exam_id}
  → Get all student reports for an exam
  
GET /api/proctor/report/{exam_id}/{student_id}
  → Get full audit report for one student
  
POST /api/proctor/teacher-review/{report_id}
  → Teacher marks verdict (cleared/cheating/needs investigation)
```

---

## DATABASE TABLES

### ✅ AVAILABLE (Supabase)

- `profiles` - Student/teacher profiles
- `exams` - Exam metadata
- `questions` - Question content
- `exam_invites` - Student invitations
- `exam_sessions` - Student exam sessions
- `flags` - Proctoring flags (high-severity events)
- `behavior_logs` - Detailed behavioral log entries
- `exam_reports` - Final reports (if exists)

### ❌ NOT AVAILABLE (As Requested SQLAlchemy Models)

- `ProctoringSession` - Not as Python model (exists as Supabase table `exam_sessions`)
- `ProctoringReport` - Not as Python model (partial in `exam_reports` table)
- `FaceFrameLog` - Not created (would need to store frame snapshots)
- `VoiceEventLog` - Implemented as behavior_logs entries
- `ScreenFrameLog` - Not created

---

## DEPENDENCIES

### ✅ INSTALLED

```json
{
  "face-api.js": "^0.22.2",
  "@google/generative-ai": "^0.24.1",
  "@supabase/supabase-js": "^2.99.1",
  "react": "19.2.3",
  "next": "16.1.6",
  "typescript": "^5"
}
```

### ❌ NOT INSTALLED (From requirements.txt)

```
deepface==0.0.93
opencv-python==4.9.0.80
mediapipe==0.10.14
anthropic>=0.40.0
Pillow>=10.0
sentence-transformers==2.7.0
scikit-learn>=1.3.0
nltk>=3.8
scipy>=1.11
```

---

## ESTIMATED COMPLETION MAP

| Layer | Status | % Complete | Key Gaps |
|-------|--------|-----------|----------|
| **Layer 1: Frontend Capture** | Partial | 45% | Missing modular tracker classes, screen lock enforcer, overlay UI |
| **Layer 2: AI Detection** | Good | 70% | Missing face analyzer, audio analyzer, screen analyzer (Python modules) |
| **Layer 3: Risk Aggregation** | Minimal | 20% | Missing unified risk score, thresholds, action mapper, heartbeat |
| **Layer 4: Teacher Dashboard** | Partial | 40% | Missing ProctorDashboard component, teacher review actions, PDF export |
| **Overall** | **Alpha** | **40%** | Functional but incomplete proctoring |

---

## FILE STRUCTURE COMPARISON

### Requested Structure:
```
proctoring/
├── frontend/              ← NOT CREATED
│   ├── KeyboardTracker.js
│   ├── ClipboardTracker.js
│   ├── WindowFocusTracker.js
│   ├── ScreenLockEnforcer.js
│   ├── WebcamCapture.js
│   ├── AudioVAD.js
│   ├── ProctoringSession.js
│   └── ProctoringOverlay.jsx
├── backend/               ← PARTIALLY IN src/lib & src/app/api
│   ├── face_analyzer.py   ❌
│   ├── audio_analyzer.py  ❌
│   ├── screen_analyzer.py ❌
│   ├── behavioral_analyzer.py ✅ (TypeScript)
│   ├── similarity_engine.py ✅ (TypeScript)
│   ├── risk_aggregator.py ❌
│   ├── api_routes.py      ✅ (TypeScript)
│   └── models.py          ✅ (Supabase)
├── dashboard/             ← NOT CREATED
│   └── ProctorDashboard.jsx
└── requirements.txt       ❌
```

### Actual Structure:
```
src/
├── hooks/                 (Trackers as hooks, not modules)
│   ├── useProctoring.ts         ✅ (combines multiple trackers)
│   ├── useWebcam.ts             ✅ (camera access)
│   ├── useNoiseDetection.ts     ✅ (audio detection)
│   ├── useExamTimer.ts          ✅ (unrelated)
│   ├── useRealtimeFlags.ts      ✅ (teacher view)
│   └── useAutoSave.ts           ✅ (unrelated)
├── lib/
│   ├── ai-detection.ts          ✅
│   ├── semantic-similarity.ts   ✅
│   ├── grading.ts               ✅
│   ├── pdf-report.ts            ✅ (incomplete)
│   └── gemini.ts                ✅
├── app/api/
│   ├── flag-event/route.ts      ✅
│   ├── analyze-behavior/route.ts ✅
│   ├── detect-collusion/route.ts ✅
│   ├── grade-answers/route.ts    ✅
│   ├── generate-report/route.ts  ✅ (may be incomplete)
│   └── submit-exam/route.ts      ✅
└── components/
    ├── exam/
    │   ├── ExamReport.tsx        ✅
    │   ├── ExamMonitor.tsx       ✅
    │   ├── NoiseWarning.tsx      ✅
    │   ├── WebcamView.tsx        ❌ (empty)
    │   └── StudentMonitorCard.tsx ❌ (empty)
    └── student/
        └── ExamTaker.tsx         ✅
```

---

## QUICK IMPLEMENTATION CHECKLIST

To complete the system as described in the prompt, you need:

### Frontend (High Priority)
- [ ] Create `/proctoring/frontend/` with modular tracker classes (8 files)
- [ ] Implement `ProctoringOverlay.jsx` React component for UI
- [ ] Add `ScreenLockEnforcer.js` for fullscreen control
- [ ] Implement periodic frame capture from `WebcamCapture.js`
- [ ] Add proper `AudioVAD.js` with VAD algorithm

### Backend (Medium Priority)
- [ ] Create `/proctoring/backend/` with Python modules (7 files)
- [ ] Implement `face_analyzer.py` with deepface integration
- [ ] Implement `screen_analyzer.py` with Claude Vision API
- [ ] Create `risk_aggregator.py` for unified 0-100 score
- [ ] Add `/api/proctor/*` endpoints (7 new routes)

### Dashboard (High Priority)
- [ ] Create `ProctorDashboard.jsx` with risk table & visualization
- [ ] Add teacher review verdict system
- [ ] Implement PDF report export
- [ ] Add radar chart for score breakdown

### Integration (Critical)
- [ ] Wire up `/proctoring/frontend/` modules into exam component
- [ ] Connect heartbeat loop to frontend risk updates
- [ ] Map risk thresholds to auto-actions (warn/pause/lock)
- [ ] Create data migration for ProctoringSession models

---

## NOTES

1. **Current Architecture**: Hooks + Supabase (not Python backend). Migrating to modular JS classes + Python would require significant refactoring.

2. **API Strategy**: Current implementation uses Next.js routes. Adding standalone Python backend (`/proctoring/backend/`) would require Docker + separate service orchestration.

3. **Risk Scoring**: Currently no unified 0-100 score. Each component (face, audio, behavior, plagiarism, AI) scores independently; no aggregator.

4. **Live Proctoring**: No heartbeat system or live risk updates. Teachers only see final reports after exam submission.

5. **Screen Analysis**: Implemented in TypeScript but calls Gemini (not Claude). To use Claude Vision API as in the prompt, would need refactoring.


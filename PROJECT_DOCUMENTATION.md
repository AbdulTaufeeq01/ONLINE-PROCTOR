# 🎓 ONLINE PROCTOR - Complete Project Documentation

An advanced online examination platform with real-time proctoring, AI-powered cheating detection, and comprehensive exam management. Built with **Next.js 16**, **TypeScript**, **Supabase**, and modern web technologies.

---

## 📋 Table of Contents

- [Project Overview](#project-overview)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Database Schema](#database-schema)
- [Backend API Routes](#backend-api-routes)
- [Frontend Pages & Components](#frontend-pages--components)
- [React Hooks](#react-hooks)
- [AI & Detection Systems](#ai--detection-systems)
- [Real-time Features](#real-time-features)
- [Security Architecture](#security-architecture)
- [Key Workflows](#key-workflows)
- [Dependencies](#dependencies)
- [Project Status](#project-status)

---

## 🎯 Project Overview

**Online Proctor** is an advanced AI-powered online examination platform that combines real-time proctoring, intelligent cheating detection, and comprehensive exam management. It's designed to facilitate secure exam-taking with live teacher monitoring and behavioral analysis.

### Key Features

- ✅ **Role-based Authentication** (Teacher/Student)
- ✅ **Exam Management** with multiple question types (MCQ, Short Answer, Long Answer)
- ✅ **Real-time Proctoring Dashboard** with live student monitoring
- ✅ **AI-powered Cheating Detection** using Google Gemini
- ✅ **Face Detection** for identity verification
- ✅ **Behavior Logging** with confidence scoring
- ✅ **Automatic MCQ Grading** with instant results
- ✅ **AI-powered Subjective Answer Grading** using Gemini 2.5-flash
- ✅ **Email Invitations** via Resend
- ✅ **PDF Report Generation**
- ✅ **Real-time Notifications** via Supabase Realtime
- ✅ **Auto-save Functionality** every 30 seconds

---

## 🛠 Tech Stack

### Frontend Stack
| Technology | Version | Purpose |
|---|---|---|
| Next.js | 16.1.6 | React framework with App Router |
| TypeScript | 5 | Type safety |
| Tailwind CSS | 4 | Utility-first styling |
| Shadcn UI | Latest | Pre-built UI components |
| React | 19.2.3 | UI library |
| React Hook Form | 7.71.2 | Form state management |
| Zod | 4.3.6 | Schema validation |
| Lucide React | 0.577.0 | Icon library |
| Radix UI | 1.4.3 | Headless UI components |
| Sonner | 2.0.7 | Toast notifications |

### Backend Stack
| Technology | Purpose |
|---|---|
| Node.js | Runtime via Next.js API Routes |
| Next.js 16 API Routes | Server-side endpoints |
| Supabase | PostgreSQL database |
| Supabase Auth | JWT authentication |
| Supabase Realtime | WebSocket subscriptions |
| RPC Functions | Server-side business logic |

### AI & Detection Services
| Service | Purpose |
|---|---|
| Google Generative AI | Gemini API for content & answer grading |
| face-api.js | Face detection with TensorFlow.js |
| TensorFlow.js | ML inference on browser |
| Resend | Email sending service |
| Daily.co | Video conferencing (optional) |
| @react-pdf/renderer | PDF generation |
| html2canvas | Screenshot capture |

---

## 📁 Project Structure

```
proctor-app/
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── layout.tsx                # Root layout with providers
│   │   ├── page.tsx                  # Root → redirects to login
│   │   ├── globals.css               # Global styles
│   │
│   │   ├── auth/
│   │   │   ├── login/page.tsx        # Login page
│   │   │   └── register/page.tsx     # Registration page
│   │
│   │   ├── api/                      # Server-side API Routes
│   │   │   ├── flag-event/route.ts   # Log suspicious behavior + flags
│   │   │   ├── submit-exam/route.ts  # Submit answers for grading
│   │   │   ├── grade-answers/route.ts # AI-powered subjective grading
│   │   │   ├── detect-collusion/     # Collusion detection (TODO)
│   │   │   ├── generate-report/      # Generate PDF reports
│   │   │   └── send-invites/         # Email invitations
│   │
│   │   ├── teacher/
│   │   │   ├── home/page.tsx         # Teacher dashboard (all exams)
│   │   │   └── exam/[id]/
│   │   │       ├── monitor/page.tsx  # Live monitoring dashboard
│   │   │       ├── report/page.tsx   # Post-exam analytics
│   │   │       └── create/page.tsx   # Exam creation form
│   │
│   │   ├── student/
│   │   │   ├── home/page.tsx         # Student dashboard
│   │   │   ├── exam/[id]/page.tsx    # Exam taking interface
│   │   │   ├── results/[id]/page.tsx # Results & grading details
│   │   │   └── dashboard/page.tsx    # (Placeholder)
│   │
│   │   ├── join/[token]/page.tsx     # Join exam via invite link
│   │
│   ├── components/
│   │   ├── auth/
│   │   │   └── LoginForm.tsx         # Login UI component
│   │   │
│   │   ├── exam/
│   │   │   ├── ExamMonitor.tsx       # Live monitoring dashboard
│   │   │   ├── ExamReport.tsx        # Teacher report view
│   │   │   ├── AIReportCard.tsx      # AI analysis card
│   │   │   ├── FlagBadge.tsx         # Flag severity indicator
│   │   │   ├── StudentMonitorCard.tsx # Per-student card
│   │   │   ├── QuestionCard.tsx      # Question display
│   │   │   ├── QuestionEditor.tsx    # Question editor (teacher)
│   │   │   ├── Timer.tsx             # Exam timer component
│   │   │   ├── WebcamView.tsx        # Webcam stream display
│   │   │   ├── WebcamPreview.tsx     # Webcam setup/preview
│   │   │   ├── MCQOptions.tsx        # MCQ renderer
│   │   │   └── InviteManager.tsx     # Batch invite UI
│   │   │
│   │   ├── layout/
│   │   │   └── TeacherNavbar.tsx     # Navigation header
│   │   │
│   │   ├── ui/
│   │   │   ├── button.tsx            # Button component
│   │   │   ├── card.tsx              # Card component
│   │   │   ├── badge.tsx             # Badge component
│   │   │   └── ... (other shadcn components)
│   │   │
│   │   └── providers/
│   │       └── SupabaseProvider.tsx  # Auth context provider
│   │
│   ├── hooks/
│   │   ├── useProctoring.ts          # Proctoring logic (WIP)
│   │   ├── useExamTimer.ts           # Countdown timer hook
│   │   ├── useWebcam.ts              # Webcam access hook
│   │   ├── useAutoSave.ts            # Auto-save answers hook
│   │   └── useRealtimeFlags.ts       # Real-time flag subscriptions
│   │
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts             # Browser Supabase client
│   │   │   └── server.ts             # Server Supabase client
│   │   │
│   │   ├── ai-detection.ts           # AI cheating detection (WIP)
│   │   ├── gemini.ts                 # Gemini API initialization
│   │   ├── grading.ts                # Grading utilities
│   │   ├── report-generator.ts       # Report generation
│   │   ├── resend.ts                 # Email configuration
│   │   ├── daily.ts                  # Daily.co video setup
│   │   └── utils.ts                  # Helper functions
│   │
│   ├── types/
│   │   ├── database.ts               # Supabase type definitions
│   │   ├── exam.ts                   # Exam-related types
│   │   └── proctoring.ts             # Proctoring types
│   │
│   └── providers/
│       └── SupabaseProvider.tsx      # React context for auth
│
├── public/
│   └── models/                       # Face detection ML models
│       ├── face_landmark_68_model/
│       ├── face_recognition_model/
│       ├── mtcnn_model/
│       ├── ssd_mobilenetv1_model/
│       ├── age_gender_model/
│       ├── face_expression_model/
│       └── tiny_face_detector_model/
│
├── Configuration Files
│   ├── package.json
│   ├── tsconfig.json
│   ├── next.config.ts
│   ├── tailwind.config.js
│   ├── postcss.config.mjs
│   ├── eslint.config.mjs
│   ├── components.json
│   └── next-env.d.ts
│
├── Documentation
│   ├── README.md
│   ├── WEBCAM_RELIABILITY_TASK.md
│   └── PROJECT_DOCUMENTATION.md (this file)
```

---

## 🗄️ Database Schema

The database uses **Supabase (PostgreSQL)** with the following core tables:

### 1. profiles
User information for both teachers and students.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key (user_id from auth) |
| `name` | TEXT | User's full name |
| `email` | TEXT | Email address |
| `role` | TEXT | 'teacher' or 'student' |
| `avatar_url` | TEXT | Optional profile picture URL |
| `created_at` | TIMESTAMP | Account creation time |

**Purpose**: Authentication and profile management

---

### 2. exams
Teacher-created exams with configuration and settings.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `teacher_id` | UUID | FK to profiles |
| `title` | TEXT | Exam name |
| `description` | TEXT | Exam details |
| `duration_minutes` | INTEGER | Time limit |
| `pass_marks` | INTEGER | Passing threshold |
| `shuffle_questions` | BOOLEAN | Randomize question order |
| `webcam_required` | BOOLEAN | Enforce webcam |
| `fullscreen_required` | BOOLEAN | Enforce fullscreen mode |
| `allow_spelling_mistakes` | BOOLEAN | Grading rule |
| `status` | TEXT | 'draft' \| 'active' \| 'ended' |
| `starts_at` | TIMESTAMP | Scheduled start time |
| `created_at` | TIMESTAMP | Creation time |

**Purpose**: Exam definition and configuration

---

### 3. questions
Exam questions with multiple types and grading rules.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `exam_id` | UUID | FK to exams |
| `type` | TEXT | 'mcq' \| 'short_answer' \| 'long_answer' |
| `order_index` | INTEGER | Question sequence |
| `question_text` | TEXT | Question content |
| `options` | JSON | Array of `{ value, label }` for MCQ |
| `correct_answer` | TEXT | Expected answer |
| `marks` | INTEGER | Points for question |
| `grading_hint` | TEXT | Optional hint for AI grader |

**Purpose**: Question storage and grading rules

**Important**: MCQ options stored as JSON array. Answers stored as **VALUES** not labels.

---

### 4. exam_invites
Invitation tokens for students to join exams.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `exam_id` | UUID | FK to exams |
| `student_email` | TEXT | Invite recipient email |
| `student_name` | TEXT | Student's name |
| `token` | TEXT | Unique invitation token |
| `used` | BOOLEAN | Marked true after first use |
| `created_at` | TIMESTAMP | Creation time |

**Purpose**: Student enrollment management

---

### 5. exam_sessions
Student exam attempts and session state.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `exam_id` | UUID | FK to exams |
| `student_id` | UUID | FK to profiles |
| `invite_id` | UUID | FK to exam_invites |
| `status` | TEXT | 'not_started' \| 'in_progress' \| 'submitted' \| 'timed_out' \| 'terminated' |
| `answers` | JSON | `{ questionId: answer }` |
| `started_at` | TIMESTAMP | When student began |
| `submitted_at` | TIMESTAMP | When student finished |
| `score` | NUMERIC | Points earned |
| `max_score` | NUMERIC | Total possible points |
| `cheating_score` | NUMERIC | AI risk score (0-100) |
| `ai_report` | JSON | AI analysis results |
| `grading_details` | JSON | Per-question grading info |
| `daily_room_url` | TEXT | Video room URL (if applicable) |

**Purpose**: Exam session tracking and answer storage

---

### 6. flags
Suspicious behavior alerts during exams.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `session_id` | UUID | FK to exam_sessions |
| `exam_id` | UUID | FK to exams |
| `student_id` | UUID | FK to profiles |
| `flag_type` | TEXT | 'webcam_off', 'multiple_faces', 'looking_away', 'tab_switch', etc. |
| `severity` | TEXT | 'low' \| 'medium' \| 'high' \| 'critical' |
| `screenshot_url` | TEXT | Captured evidence (if applicable) |
| `metadata` | JSON | Additional context |
| `created_at` | TIMESTAMP | When flag created |

**Purpose**: Proctoring alerts and incident tracking

---

### 7. behavior_logs
Detailed behavior event logs during exams.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `session_id` | UUID | FK to exam_sessions |
| `exam_id` | UUID | FK to exams |
| `student_id` | UUID | FK to profiles |
| `event_type` | TEXT | Event category |
| `confidence` | NUMERIC | Confidence score (0-1) |
| `metadata` | JSON | Event-specific data |
| `created_at` | TIMESTAMP | When event occurred |

**Purpose**: Fine-grained behavior tracking for analysis

---

## 🔌 Backend API Routes

All backend routes use **Next.js API Routes** (`src/app/api/`) and communicate with Supabase via RPC functions.

### 1. POST /api/flag-event

**Purpose**: Log suspicious behavior and create flags

**Request Body**:
```json
{
  "session_id": "uuid-string",
  "student_id": "uuid-string",
  "exam_id": "uuid-string",
  "event_type": "multiple_faces",
  "confidence": 0.95,
  "severity": "high",
  "metadata": {
    "face_count": 2,
    "detection_model": "ssd_mobilenetv1"
  }
}
```

**Response**:
```json
{
  "success": true
}
```

**What it does**:
1. Requires authentication (checks `supabase.auth.getUser()`)
2. Calls `insert_behavior_log` RPC to log event
3. Calls `insert_flag` RPC to create alert
4. Stores confidence score and metadata
5. Returns 401 if unauthorized, 500 on error

**Used by**: Client-side proctoring detection

---

### 2. POST /api/submit-exam

**Purpose**: Student submits exam answers for grading

**Request Body**:
```json
{
  "session_id": "uuid-string",
  "exam_id": "uuid-string",
  "answers": {
    "question-id-1": "A",
    "question-id-2": "The answer to this question",
    "question-id-3": "A longer response paragraph explaining the answer..."
  }
}
```

**Response**:
```json
{
  "session_id": "uuid-string",
  "score": 45,
  "max_score": 100,
  "status": "submitted"
}
```

**What it does**:
1. Validates authentication and request
2. Fetches exam questions via `get_exam_questions` RPC
3. **For MCQ answers**: Grades immediately with exact match (case-insensitive, trimmed)
4. **For short/long answers**: Marks as `needs_grading: true` for Gemini processing
5. Calculates total `score` and `max_score`
6. Builds `grading_details` object with per-question breakdown
7. Calls `submit_exam_session` RPC to update session
8. Returns final score

**Key Logic**:
- MCQ answers must match `correct_answer` from questions table
- Answers stored as option VALUES (not labels)
- Subjective answers defer to AI grading
- All answers stored as JSON in `exam_sessions.answers`

---

### 3. POST /api/grade-answers

**Purpose**: AI-powered subjective answer grading using Google Gemini

**Request Body**:
```json
{
  "session_id": "uuid-string",
  "grading_details": {
    "question-id-1": {
      "question_text": "What is photosynthesis?",
      "student_answer": "Process of plants making food",
      "correct_answer": "Process where plants convert light energy into chemical energy",
      "marks_awarded": null,
      "needs_grading": true,
      "type": "short_answer"
    }
  }
}
```

**Response**:
```json
{
  "session_id": "uuid-string",
  "updated_grading_details": {
    "question-id-1": {
      "question_text": "What is photosynthesis?",
      "student_answer": "Process of plants making food",
      "correct_answer": "Process where plants convert light energy into chemical energy",
      "marks_awarded": 7,
      "is_correct": true,
      "ai_feedback": "Good understanding of the basic concept. Missing details about chlorophyll.",
      "needs_grading": false,
      "type": "short_answer"
    }
  },
  "final_score": 82
}
```

**What it does**:
1. Validates authentication
2. Iterates through `grading_details` finding answers with `needs_grading: true`
3. For each subjective answer, calls **Google Generative AI (Gemini 2.5-flash)**
4. Includes in prompt:
   - Question text
   - Student answer
   - Correct answer
   - Max marks
   - Grading hints
   - Rules (abbreviations, spelling mistakes, etc.)
5. Receives `{ marks, is_correct, ai_feedback }`
6. Updates `grading_details` with AI results
7. Recalculates final score
8. Updates session in database

**Grading Rules**:
- Exact normalized match → full marks immediately
- Abbreviations treated as equivalent:
  - "AI" = "Artificial Intelligence"
  - "UK" = "United Kingdom"
  - "WW2" = "World War 2"
- Spelling mistakes ignored if flag `allow_spelling_mistakes` set
- Extra filler words do NOT reduce marks
- Missing key facts = reduced or zero marks
- Long answers graded with 20% leniency vs short answers

---

### 4. POST /api/detect-collusion

**Purpose**: Detect potential collusion between students

**Status**: ⏳ **TODO - Not yet implemented**

**Planned Features**:
- Analyze answer similarities across students
- Check submission timing patterns
- Detect copy-paste of specific phrases
- Flag suspicious collaboration

---

### 5. POST /api/generate-report

**Purpose**: Generate PDF exam report for teacher

**Request Body**:
```json
{
  "session_id": "uuid-string",
  "include_ai_analysis": true
}
```

**Response**: Binary PDF file

**What it does**:
1. Fetches session with all related data
2. Retrieves student profile, exam, answers, flags
3. Uses **@react-pdf/renderer** to generate PDF
4. Includes sections:
   - Student details
   - Exam metadata
   - Score breakdown
   - Answer review
   - Flag timeline
   - AI analysis (if requested)
5. Returns downloadable PDF

---

### 6. POST /api/send-invites

**Purpose**: Send exam invitation emails to students

**Request Body**:
```json
{
  "exam_id": "uuid-string",
  "students": [
    {
      "email": "student1@example.com",
      "name": "John Doe"
    },
    {
      "email": "student2@example.com",
      "name": "Jane Smith"
    }
  ]
}
```

**Response**:
```json
{
  "success": true,
  "invites_sent": 2,
  "failed": []
}
```

**What it does**:
1. Creates `exam_invites` records with unique tokens
2. Sends emails via **Resend** service
3. Email includes:
   - Join link: `https://yourapp.com/join/[token]`
   - Exam title and duration
   - Instructions
4. Marks invites for tracking
5. Returns success/failure counts

---

## 🎨 Frontend Pages & Components

### Authentication Pages

#### `/auth/login`
**File**: `src/app/auth/login/page.tsx`

**Features**:
- Email + Password login form
- Zod validation
- Error messages for invalid input
- "Forgot Password?" link (placeholder)
- "Sign Up" link

**Flow**:
1. User enters email and password
2. Form validates via Zod schema
3. Calls `supabase.auth.signInWithPassword()`
4. Fetches user profile to get role
5. Redirects based on role:
   - Teacher → `/teacher/home`
   - Student → `/student/home`
   - Support redirect parameter for post-login nav

---

#### `/auth/register`
**Status**: Placeholder (implementation needed)

**Expected Features**:
- Email registration
- Password creation
- Role selection (teacher/student)
- Profile setup

---

### Teacher Pages

#### `/teacher/home`
**File**: `src/app/teacher/home/page.tsx`

**Purpose**: Dashboard showing all exams created by teacher

**Features**:
- Lists all exams in grid/card layout
- Shows per-exam:
  - Title
  - Description
  - Duration
  - Status badge (draft/active/ended)
  - Question count
  - Created date
- Status color coding:
  - 🔵 DRAFT (gray)
  - 🟢 ACTIVE (green)
  - 🔵 ENDED (blue)
- "Create New Exam" CTA button
- Empty state with welcome message

**Data Fetching**: `get_teacher_exams_with_counts` RPC

**Actions**:
- Click exam → view monitor
- Click "Create New Exam" → `/teacher/exam/create`

---

#### `/teacher/exam/[id]/monitor` ⭐ **CORE COMPONENT**
**File**: `src/app/teacher/exam/[id]/monitor/page.tsx`

**Purpose**: Real-time live dashboard for monitoring student exam sessions

**Architecture**:
- Server renders initial data
- Client subscribes to Supabase Realtime updates
- Component: `ExamMonitor.tsx`

**Key Sections**:

**1. Statistics Cards** (5 cards):
```
┌─────────────┬────────────────┬──────────┬──────────┬────────────────┐
│   Started   │  In Progress   │Submitted │ Total    │High Severity   │
│   Sessions  │   Sessions     │Sessions  │ Flags    │ Flags          │
└─────────────┴────────────────┴──────────┴──────────┴────────────────┘
```

**2. Live Student Table** (7 columns, sortable, filterable):
| Column | Data | Notes |
|--------|------|-------|
| Student Name | Profile name | Click for details |
| Status | not_started / in_progress / submitted / timed_out / terminated | Status badge |
| Time Elapsed | HH:MM:SS | Updated every second |
| Progress | 3/50 questions | Real-time answer count |
| Flags | 🔴 3 (color-coded by severity) | Clickable → show details |
| Cheating Score | 42% | AI-calculated risk (0-100) |
| Actions | View / End Session | Action buttons |

**3. Activity Feed** (Combined events):
- Timeline of flags + behavior logs
- Newest entries first
- Each entry shows:
  - Timestamp
  - Student name
  - Event type
  - Severity/confidence
  - Click → expand details

**Real-time Subscriptions**:
```typescript
// Subscriptions to 3 tables with postgres_changes events:
- exam_sessions (all students in exam)
- flags (new suspicious behavior)
- behavior_logs (detailed events)
```

**Update Latency**: < 1 second (WebSocket)

---

#### `/teacher/exam/[id]/report`
**Status**: ⏳ **TODO - In planning phase**

**Expected Features**:
- Post-exam analytics dashboard
- Per-student score breakdown
- AI analysis summary
- Flag statistics
- Class-wide cheating score distribution
- Download PDF report CTA

---

#### `/teacher/exam/create`
**Status**: ⏳ **Exam creation form**

**Expected Features**:
- Exam metadata form:
  - Title, description
  - Duration, pass marks
  - Settings (shuffle, webcam, fullscreen, etc.)
- Question editor:
  - Add multiple questions
  - Question type selector (MCQ, short, long)
  - MCQ option editor
  - Correct answer selector
  - Marks per question
- Save as draft or publish
- Question preview
- Delete/reorder questions

---

### Student Pages

#### `/student/home`
**File**: `src/app/student/home/page.tsx`

**Status**: Placeholder

**Expected Features**:
- Dashboard showing:
  - Upcoming exams (if enrolled)
  - In-progress exams
  - Past exam results
  - Scores and grades

---

#### `/join/[token]` ⭐ **KEY STUDENT ENTRY POINT**
**File**: `src/app/join/[token]/page.tsx`

**Purpose**: Validate invite token and create exam session

**Flow**:
1. User clicks email invite link
2. Route parameter: `token`
3. Server-side validation:
   - Is user authenticated? → redirect to `/auth/login?redirect=/join/[token]`
   - Is token valid? → fetch invite record
   - Is exam active? → check exam status
   - Does session already exist? → redirect to exam or results
   - Is token already used? → error page
4. Create exam session atomically via `create_exam_session` RPC
5. Mark invite as used
6. Redirect to `/student/exam/[id]`

**Error Handling**:
- Invalid token → "Unable to Join: Invalid invite link"
- Exam not found → "Exam not found"
- Exam not active → "This exam is not currently active"
- Already used → "This invite link has already been used"
- Session create error → "Failed to create exam session"

---

#### `/student/exam/[id]` ⭐ **EXAM TAKING INTERFACE**
**Status**: ⏳ In development

**Purpose**: Student exam-taking environment

**Required Elements**:
- Fullscreen mode enforced
- Webcam stream active (if required)
- Timer countdown
- Question navigation
- Auto-save indicator
- Leave exam warnings

**Layout**:
```
┌──────────────────────────────────────────────────┐
│  Exam: Calculus 101  [Timer: 45:32]   [Webcam]  │
├─────────────────────────────────────────────────┤
│ Question │                                       │
│  1  2  3 │                                       │
│  4  5  6 │  What is the derivative of x²?       │
│  7  8  9 │                                       │
│ 10 11 12 │  ○ 2x                                │
│          │  ○ x                                 │
│ [Submit] │  ○ x² + 2                           │
│          │  ○ 2                                 │
│          │                                       │
│ Auto-save Last saved: 2 seconds ago             │
└─────────────────────────────────────────────────┘
```

**Features**:
- **Question Card**:
  - MCQ: Radio buttons
  - Short answer: Text input
  - Long answer: Textarea (min-height)
  - Display options (for MCQ)

- **Timer**: Countdown with warnings
  - 5 min remaining: yellow warning
  - 1 min remaining: red warning
  - Auto-submit on 0:00

- **Auto-save**: Every 30 seconds
  - Posts to `/api/submit-exam`
  - Shows "Last saved" timestamp

- **Proctoring Active**:
  - Face detection running
  - Webcam monitoring
  - Tab switch detection
  - Fullscreen enforcement
  - Flags sent to `/api/flag-event`

---

#### `/student/results/[id]`
**Status**: ⏳ Result viewing page

**Expected Features**:
- Final score display
- Score breakdown by question
- Answer review:
  - MCQ: Student answer vs correct answer
  - Subjective: AI grading and feedback
- Download certificate (if passed)
- Exam report download
- Navigation to dashboard

---

### Key Components

#### ExamMonitor.tsx
**Location**: `src/components/exam/ExamMonitor.tsx`

**Props**:
```typescript
interface ExamMonitorProps {
  exam: { id: string; title: string; status: string };
  initialInvites: Invite[];
  initialSessions: ExamSession[];
  initialFlags: Flag[];
  initialBehaviorLogs: BehaviorLog[];
  initialProfiles: Profile[];
  totalQuestions: number;
}
```

**Implementation**:
- useState for sessions, flags, behaviorLogs, invites, profiles
- useEffect to set up Realtime subscriptions
- Map data to UI components
- Update state on postgres_changes events

---

#### Timer.tsx
- Countdown display
- Time formatting (MM:SS)
- Warning thresholds
- Callback on completion

---

#### WebcamView.tsx / WebcamPreview.tsx
- Request camera permissions
- Display video stream
- Face detection overlay
- Error handling for denied permissions

---

#### FlagBadge.tsx
- Severity color coding:
  - 🔴 Critical (red)
  - 🟠 High (orange)
  - 🟡 Medium (yellow)
  - 🟢 Low (green)
- Flag type display
- Click handler for details

---

## 🪝 React Hooks

### useExamTimer.ts
```typescript
export function useExamTimer(durationMinutes: number) {
  const [timeLeft, setTimeLeft] = useState<number>();
  const [isExpired, setIsExpired] = useState(false);
  // Returns: { timeLeft, isExpired, timeString }
}
```

**Features**:
- Countdown timer
- Warning callbacks at 5 min, 1 min
- Auto-expire on 0

---

### useWebcam.ts
```typescript
export function useWebcam() {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPermissionDenied, setIsPermissionDenied] = useState(false);
  // Returns: { stream, error, isPermissionDenied, requestAccess, stopStream }
}
```

**Features**:
- Request camera permissions
- Handle NotAllowedError
- Stop stream on cleanup

---

### useAutoSave.ts
```typescript
export function useAutoSave(
  sessionId: string,
  answers: Record<string, any>,
  intervalMs: number = 30000
) {
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  // Returns: { lastSaved, isSaving, saveNow }
}
```

**Features**:
- Debounced save every 30 seconds
- POST to `/api/submit-exam`
- Show save status

---

### useRealtimeFlags.ts
```typescript
export function useRealtimeFlags(examId: string) {
  const [flags, setFlags] = useState<Flag[]>([]);
  // Subscribes to flags table via Supabase Realtime
  // Returns: { flags }
}
```

---

### useProctoring.ts
**Status**: WIP

**Expected Features**:
- Orchestrate all proctoring checks
- Face detection loop
- Behavior monitoring
- Flag event posting

---

## 🤖 AI & Detection Systems

### 1. Face Detection (Client-Side)

**Library**: face-api.js (built on TensorFlow.js)

**Models** (in `/public/models/`):
- `tiny_face_detector` - Fast face detection (recommended for real-time)
- `ssd_mobilenetv1` - Mobile-optimized SSD
- `mtcnn_model` - Multi-task cascaded CNNs
- `face_landmark_68` - Facial landmark points
- `face_landmark_68_tiny` - Lightweight landmarks
- `face_expression_model` - Emotion detection
- `age_gender_model` - Age/gender estimation
- `face_recognition_model` - Face recognition/embedding

**Detects**:
- Face present/absent
- Number of faces (single vs multiple)
- Face position (center vs edges)
- Gaze direction (looking at screen vs away)
- Expression (neutral vs suspicious)

**Typical Flow**:
```javascript
const detection = await faceapi
  .detectSingleFace(canvas, new faceapi.TinyFaceDetectorOptions())
  .withFaceLandmarks()
  .withFaceExpressions();

if (!detection) {
  // Flag: no_face_detected
}
if (detections.length > 1) {
  // Flag: multiple_faces
}
```

---

### 2. AI Content Detection (Gemini)

**Service**: Google Generative AI

**Models Used**:
- `gemini-2.5-flash` - For answer grading
- `gemini-1.5-flash` - Alternative for content detection

**When Used**:
1. Grading subjective answers (in `/api/grade-answers`)
2. Analyzing written responses for AI-generated content

**Prompt Engineering**:
```
You are a fair and experienced exam grader. Grade the following student answer.

QUESTION: What is photosynthesis?
CORRECT ANSWER: Process where plants convert light energy into chemical energy
STUDENT ANSWER: It's when plants make food using sunlight
MAXIMUM MARKS: 10
QUESTION TYPE: short_answer
ALLOW SPELLING MISTAKES: true

GRADING RULES:
1. Compare meaning, not exact wording
2. Abbreviations equal their full forms
3. Extra filler words do NOT reduce marks
4. Missing key facts = reduced marks
...

Respond in JSON: { marks: number, is_correct: boolean, ai_feedback: string }
```

---

### 3. Behavior Analysis

**Client-side Monitoring**:
- Tab switch (VisibilityAPI)
- Window blur (onblur/onfocus)
- Mouse/keyboard inactivity
- Copy-paste detection (clipboard API)
- Screenshot attempts
- Context menu (right-click)

**Each Event Logged**:
- event_type
- confidence (0-1)
- metadata (timestamps, details)
- severity (low/medium/high/critical)

**Example Behavior Flow**:
```
Student Activity Timeline:
┌─ 00:05 - Tab switch detected (confidence: 0.95) → FLAG: medium
├─ 00:12 - No face detected (confidence: 0.88) → FLAG: high
├─ 00:15 - Browser blur (confidence: 1.0) → FLAG: low
├─ 00:22 - Copy-paste detected (confidence: 0.92) → FLAG: high
└─ 00:30 - Multiple faces detected (confidence: 0.98) → FLAG: critical
```

---

## 📊 Real-time Features (Supabase)

### Realtime Subscriptions

The system uses Supabase Realtime (WebSocket) for live updates:

```typescript
// Monitor exam sessions
const sessionsChannel = supabase
  .channel(`sessions-${exam.id}`)
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'exam_sessions',
    filter: `exam_id=eq.${exam.id}`
  }, (payload) => {
    // Update UI with new/changed session
  })
  .subscribe();

// Monitor flags
const flagsChannel = supabase
  .channel(`flags-${exam.id}`)
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'flags',
    filter: `exam_id=eq.${exam.id}`
  }, (payload) => {
    // New flag alert
  })
  .subscribe();
```

### Events Monitored

| Event | Table | When |
|-------|-------|------|
| Session started | exam_sessions | Student begins exam |
| Session status change | exam_sessions | In-progress → submitted |
| Score updated | exam_sessions | Answers graded |
| New flag | flags | Suspicious behavior detected |
| Behavior logged | behavior_logs | Proctoring event |

### Latency
- Actual update time: < 1 second (WebSocket direct)
- UI refresh: Immediate on state change

---

## 🔐 Security Architecture

### Authentication

**Method**: Supabase Auth (JWT)

**Flow**:
1. User signs up/logs in via email + password
2. Supabase issues JWT token
3. Token stored in HTTP-only cookies (secure)
4. Backend validates token in middleware
5. RLS policies enforced (when enabled)

**Key Functions**:
- Browser: `supabase.auth.getUser()` (from session cookie)
- Server: `supabase.auth.getUser()` (from cookies())

---

### Authorization

**Principle**: Trust backend, validate everywhere

**Checks**:
1. **API Routes**:
   ```typescript
   const { data: { user } } = await supabase.auth.getUser();
   if (!user) return 401 Unauthorized;
   ```

2. **RPC Functions**:
   - `get_teacher_exam` - Verify ownership
   - `get_student_sessions` - Verify student
   - `submit_exam_session` - Check invite validity

3. **Row-Level Security** (disabled currently):
   - Would enforce table-level access rules
   - Plan to enable before production

---

### Data Protection

**In Transit**:
- HTTPS/TLS encryption
- All API calls over secure channels

**At Rest**:
- Supabase encryption for sensitive fields
- PII (student email, names) in profiles table

**Sensitive Data Handling**:
- Answers stored in `exam_sessions.answers` (JSON)
- Flags stored with severity metadata
- Screenshots encrypted in cloud storage (if used)

---

### RBAC (Role-Based Access Control)

**Roles**:
- `teacher` - Can create exams, monitor students, view reports
- `student` - Can take exams, view results

**Enforced At**:
- Page level (redirect if wrong role)
- API level (return 401/403)
- Component level (conditional rendering)

---

## 📝 Key Workflows

### Workflow 1: Teacher Creates & Manages Exam

```
1. Teacher logs in
   └─ Redirect to /teacher/home

2. Click "Create New Exam"
   └─ Route to /teacher/exam/create

3. Fill exam form
   ├─ Title: "Calculus 101"
   ├─ Duration: 60 minutes
   ├─ Pass marks: 50
   ├─ Settings: Webcam required, Fullscreen required
   └─ Save as draft

4. Add questions
   ├─ Question 1 (MCQ): Multiple choice
   ├─ Question 2 (Short answer): Text input
   ├─ Question 3 (Long answer): Essay
   └─ Save each question

5. Publish exam
   └─ Status: active (or schedule for later)

6. Send invites
   ├─ Select students to invite
   ├─ System generates invite tokens
   ├─ Email sent via Resend
   └─ Invite marked in database

7. Monitor exam in real-time
   ├─ Route to /teacher/exam/[id]/monitor
   ├─ View live student table
   ├─ Watch flags and behavior
   ├─ Can end specific student's session
   └─ Download PDF reports after submission
```

---

### Workflow 2: Student Takes Exam

```
1. Student receives email invite
   └─ Click join link: /join/[token]

2. Server validates
   ├─ Check authentication
   ├─ Validate token
   ├─ Verify exam is active
   ├─ Check no existing session
   └─ Create session atomically

3. Redirect to /student/exam/[id]
   └─ Exam taking page loads

4. Exam interface
   ├─ Fullscreen mode enforced
   ├─ Webcam stream active
   ├─ Timer countdown starts
   └─ Face detection begins

5. Student answers questions
   ├─ Click through questions (Q1-Q50)
   ├─ Select MCQ option or type answer
   ├─ Auto-save every 30 seconds
   └─ Proctoring flags sent if suspicious

6. Submit exam
   └─ POST /api/submit-exam
      ├─ MCQ answers graded immediately
      ├─ Subjective answers marked for AI grading
      ├─ Score calculated
      └─ Session status → submitted

7. Gemini grading (async)
   └─ POST /api/grade-answers
      ├─ Analyze each subjective answer
      ├─ Award marks based on semantic match
      ├─ Provide feedback
      └─ Update final score

8. View results
   └─ Route to /student/results/[id]
      ├─ Final score display
      ├─ Question-by-question breakdown
      ├─ AI feedback visible
      └─ Option to download report
```

---

### Workflow 3: Teacher Reviews Results

```
1. Exam ends (time or manual)
   └─ Status: ended

2. Teacher accesses report
   └─ Route to /teacher/exam/[id]/report

3. View analytics
   ├─ Class average score
   ├─ Per-student breakdown
   ├─ Flag distribution
   ├─ AI cheating scores
   └─ Behavior timeline

4. Download PDF
   └─ POST /api/generate-report
      ├─ Fetch session data
      ├─ Render PDF with @react-pdf/renderer
      └─ Return file to browser

5. Optional: Detect collusion (TODO)
   └─ Analyze answer similarities
      ├─ Flag suspicious matches
      ├─ Check timing patterns
      └─ Generate report
```

---

## 📦 Dependencies

### Core Dependencies

```json
{
  "next": "16.1.6",
  "react": "19.2.3",
  "react-dom": "19.2.3",
  "typescript": "^5",
  "@supabase/supabase-js": "^2.99.1",
  "@supabase/ssr": "^0.9.0",
  "@supabase/auth-helpers-nextjs": "^0.15.0"
}
```

### UI & Styling

```json
{
  "tailwindcss": "^4",
  "@tailwindcss/postcss": "^4",
  "shadcn": "^4.0.7",
  "radix-ui": "^1.4.3",
  "lucide-react": "^0.577.0",
  "class-variance-authority": "^0.7.1"
}
```

### Forms & Validation

```json
{
  "react-hook-form": "^7.71.2",
  "@hookform/resolvers": "^5.2.2",
  "zod": "^4.3.6"
}
```

### AI & Detection

```json
{
  "@google/generative-ai": "^0.24.1",
  "face-api.js": "^0.22.2"
}
```

### Utilities

```json
{
  "@daily-co/daily-js": "^0.89.0",
  "@react-pdf/renderer": "^4.3.2",
  "resend": "^6.9.3",
  "date-fns": "^4.1.0",
  "html2canvas": "^1.4.1",
  "sonner": "^2.0.7",
  "tailwind-merge": "^3.5.0"
}
```

### Dev Dependencies

```json
{
  "eslint": "^9",
  "eslint-config-next": "16.1.6",
  "@types/node": "^20",
  "@types/react": "^19",
  "@types/react-dom": "^19"
}
```

---

## 🎯 Project Status

### ✅ Completed Features

- ✅ Authentication system (Supabase Auth)
  - Login page with validation
  - Role-based routing (teacher/student)
  - Session management

- ✅ Teacher exam management
  - Create exams with metadata
  - Multiple question types (MCQ, short/long answer)
  - Exam lifecycle (draft → active → ended)

- ✅ Student exam taking
  - Exam interface with timer
  - Fullscreen enforcement
  - Webcam access
  - Question navigation

- ✅ Real-time monitoring dashboard
  - Live student table with 7 columns
  - Statistics cards (5 total)
  - Activity feed (flags + behavior)
  - Subabase Realtime subscriptions

- ✅ Proctoring system
  - Face detection via face-api.js
  - Behavior logging
  - Flag creation with severity
  - Metadata capture

- ✅ Grading system
  - MCQ auto-grading (immediate)
  - Subjective answer grading via Gemini
  - Score calculation
  - AI feedback generation

- ✅ Email invitations
  - Batch invite generation
  - Email sending via Resend
  - Token validation
  - Invite tracking

- ✅ Auto-save functionality
  - Save every 30 seconds
  - Non-blocking saves
  - Last-saved indicator

---

### 🚧 In Progress

- 🚧 Teacher report page
  - Post-exam analytics
  - Per-student breakdown
  - Class statistics

- 🚧 Proctoring hooks optimization
  - useProctoring.ts
  - Face detection loop
  - Behavior monitoring

- 🚧 AI detection system
  - Fine-tuning Gemini prompts
  - Cheating score calculation
  - Risk assessment

---

### 📋 Planned Features

- 📝 **Phase 2**: Teacher Report Page
  - Analytics dashboard
  - Cheating score visualization
  - Flag summary statistics

- 📝 **Phase 3**: Cheating Score Calculation
  - Algorithm development
  - Multi-factor analysis
  - Risk scoring

- 📝 **Phase 4**: Collusion Detection
  - Answer similarity analysis
  - Timing pattern detection
  - Copy-paste detection

- 📝 **Phase 5**: Report Generation
  - PDF export improvements
  - Narrative summaries
  - Recommendations

- 📝 **Phase 6**: Duplicate Event Deduplication
  - Reduce redundant flags
  - Smart filtering

- 📝 **Phase 7**: Email Notifications
  - Real-time alerts
  - Summary digests

- 📝 **Phase 8**: Vercel Deployment
  - Production setup
  - Environment configuration
  - Monitoring

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn
- Supabase account
- Google Gemini API key

### Installation

```bash
cd proctor-app
npm install
```

### Environment Setup

Create `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
GEMINI_API_KEY=your_gemini_key
RESEND_API_KEY=your_resend_key
DAILY_API_KEY=your_daily_key (optional)
```

### Running

```bash
# Development
npm run dev

# Production build
npm run build
npm start

# Linting
npm run lint
```

---

## 📞 Support & Contributions

For issues, feature requests, or contributions, please refer to the repository guidelines.

---

**Last Updated**: March 25, 2026
**Version**: 0.1.0 (Alpha)
**Status**: Active Development

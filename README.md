# 🎓 ONLINE PROCTOR - AI-Powered Exam Proctoring System

An advanced online examination platform with real-time proctoring, AI-powered cheating detection, and comprehensive exam management. Built with **Next.js 16**, **TypeScript**, **Supabase**, and modern web technologies.

---

## 📋 Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [System Architecture](#system-architecture)
- [Installation & Setup](#installation--setup)
- [Database Schema](#database-schema)
- [API Endpoints](#api-endpoints)
- [Project Structure](#project-structure)
- [Environment Variables](#environment-variables)
- [Deployment](#deployment)
- [Key Features Explained](#key-features-explained)
- [Usage Guide](#usage-guide)

---

## ✨ Features

### 🔐 **Authentication & Authorization**
- User role-based access (Teacher/Student)
- Secure JWT authentication via Supabase Auth
- Email-based registration and login
- Profile management with avatar support

### 📝 **Exam Management (Teachers)**
- Create and manage exams with multiple question types
- Exam scheduling and lifecycle management (Draft → Active → Ended)
- Question bank with MCQ, Short Answer, and Long Answer questions
- Flexible grading with marks per question
- Support for question shuffling and full-screen requirement
- Batch student invitations via email

### 📊 **Exam Taking (Students)**
- Take exams with real-time timer
- Auto-save answers every 30 seconds
- Support for multiple question types
- Webcam and fullscreen requirements enforcement
- Real-time engagement monitoring

### 🚨 **Real-Time Proctoring**
- Live session monitoring dashboard for teachers
- Real-time flag system for suspicious behavior
- Behavior logging with confidence scoring
- Multiple detection categories:
  - Face detection and identity verification
  - Gaze tracking (looking away from screen)
  - Multiple faces detected
  - Phone/external device detection
  - Copy-paste attempts
  - Tab switching detection
  - Unnatural typing patterns

### 🤖 **AI-Powered Cheating Detection**
- Google Gemini API integration for AI-written content detection
- Multi-level analysis:
  - Question-level AI detection
  - Session-level cheating score calculation
  - Narrative summary and risk assessment
- Configurable sensitivity levels
- Detailed recommendations for flagged content

### 📈 **Comprehensive Reporting**
- Teacher dashboard with exam analytics
- Per-student session details and scores
- AI detection reports with confidence scores
- Flag summaries and behavioral analysis
- PDF report generation with student details
- Visual progress tracking

---

## 🛠 Tech Stack

### Frontend
- **Framework**: Next.js 16 (App Router, Server Components)
- **Language**: TypeScript 5
- **Styling**: Tailwind CSS 4, Shadcn UI
- **State Management**: React Hooks
- **Form Handling**: React Hook Form + Zod Validation
- **UI Components**: Radix UI, Lucide Icons

### Backend
- **Runtime**: Node.js (via Next.js API Routes)
- **Database**: Supabase (PostgreSQL)
- **Auth**: Supabase Auth
- **Realtime**: Supabase Realtime Subscriptions

### AI & Detection
- **AI Writing Detection**: Google Generative AI (Gemini)
- **Face Detection**: face-api.js (TensorFlow.js)
- **Behavior Analysis**: Custom algorithms

### Additional Services
- **Video Conferencing**: Daily.co (optional)
- **Email Service**: Resend
- **PDF Generation**: @react-pdf/renderer
- **Charts/Analytics**: Custom visualizations

### DevOps & Tools
- **Deployment**: Vercel
- **Version Control**: Git
- **Package Manager**: npm
- **Linting**: ESLint 9

---

## 🏗 System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        ONLINE PROCTOR                       │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌────────────────┐          ┌──────────────────┐           │
│  │  Next.js 16   │          │   Supabase       │           │
│  │  App Router   │◄────────►│   - Auth         │           │
│  │  - Pages      │          │   - PostgreSQL   │           │
│  │  - API Routes │          │   - Realtime     │           │
│  │  - Middleware │          │   - Storage      │           │
│  └────────────────┘          └──────────────────┘           │
│         │                                                    │
│         ├─► TypeScript Components                           │
│         ├─► React Hooks                                    │
│         └─► Form Validation (Zod)                          │
│                                                               │
│  ┌────────────────┐    ┌──────────────┐   ┌──────────────┐ │
│  │ Proctoring     │    │     AI       │   │    Video     │ │
│  │ - Face Det.    │    │  - Gemini    │   │   - Daily.co │ │
│  │ - Behavior Log │    │  - Analysis  │   │   - Rooms    │ │
│  │ - Flag System  │    │              │   │              │ │
│  └────────────────┘    └──────────────┘   └──────────────┘ │
│                                                               │
│  ┌────────────────┐    ┌──────────────┐                    │
│  │   Reports      │    │   Email      │                    │
│  │ - PDF Gen      │    │  - Resend    │                    │
│  │ - Analytics    │    │  - Invites   │                    │
│  │ - Summaries    │    │              │                    │
│  └────────────────┘    └──────────────┘                    │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## 📦 Installation & Setup

### Prerequisites
- **Node.js**: 18.x or higher
- **npm**: 9.x or higher
- **Supabase Account**: For database and authentication
- **Google Cloud Account**: For Gemini API access (optional)

### 1. Clone Repository
```bash
git clone https://github.com/AbdulTaufeeq01/ONLINE-PROCTOR.git
cd proctor-app
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Setup Environment Variables
Create `.env.local` in the root:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Google Gemini API
NEXT_PUBLIC_GOOGLE_API_KEY=your_google_api_key

# Daily.co (Optional for video conferencing)
NEXT_PUBLIC_DAILY_API_KEY=your_daily_api_key

# Resend (Email service)
RESEND_API_KEY=your_resend_api_key

# Application
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 4. Setup Supabase Database
```bash
# Create tables and RPC functions using Supabase dashboard
# SQL migrations are available in the project documentation
# Key tables: profiles, exams, questions, exam_invites, exam_sessions, flags, behavior_logs
```

### 5. Start Development Server
```bash
npm run dev
```

Visit `http://localhost:3000` in your browser.

### 6. Build for Production
```bash
npm run build
npm start
```

---

## 🗄 Database Schema

### **Profiles** (`profiles`)
```typescript
- id: UUID (PK)
- name: string
- email: string
- role: 'teacher' | 'student'
- avatar_url: string (nullable)
- created_at: timestamp
```

### **Exams** (`exams`)
```typescript
- id: UUID (PK)
- teacher_id: UUID (FK to profiles)
- title: string
- description: string (nullable)
- duration_minutes: integer
- pass_marks: integer (nullable)
- shuffle_questions: boolean
- webcam_required: boolean
- fullscreen_required: boolean
- allow_spelling_mistakes: boolean
- status: 'draft' | 'active' | 'ended'
- starts_at: timestamp (nullable)
- created_at: timestamp
```

### **Questions** (`questions`)
```typescript
- id: UUID (PK)
- exam_id: UUID (FK to exams)
- order_index: integer
- type: 'mcq' | 'short_answer' | 'long_answer'
- question_text: string
- options: JSON (nullable, for MCQ: [{"label":"A","value":"..."}])
- correct_answer: string (stored as value, not label)
- marks: integer
- grading_hint: string (nullable)
```

### **Exam Invites** (`exam_invites`)
```typescript
- id: UUID (PK)
- exam_id: UUID (FK to exams)
- student_email: string
- student_name: string (nullable)
- token: string (unique)
- used: boolean
- created_at: timestamp
```

### **Exam Sessions** (`exam_sessions`)
```typescript
- id: UUID (PK)
- exam_id: UUID (FK to exams)
- student_id: UUID (nullable, FK to profiles)
- invite_id: UUID (nullable, FK to exam_invites)
- daily_room_url: string (nullable)
- started_at: timestamp (nullable)
- submitted_at: timestamp (nullable)
- status: 'not_started' | 'in_progress' | 'submitted' | 'timed_out' | 'terminated'
- answers: JSON (question_id → answer mapping)
- score: numeric
- max_score: numeric
- cheating_score: numeric
- ai_report: JSON (nullable)
- grading_details: JSON (nullable)
```

### **Flags** (`flags`)
```typescript
- id: UUID (PK)
- session_id: UUID (FK to exam_sessions)
- student_id: UUID (FK to profiles)
- exam_id: UUID (FK to exams)
- flag_type: string (face_missing, multiple_faces, etc.)
- severity: 'low' | 'medium' | 'high' | 'critical'
- metadata: JSON
- created_at: timestamp
```

### **Behavior Logs** (`behavior_logs`)
```typescript
- id: UUID (PK)
- session_id: UUID (FK to exam_sessions)
- student_id: UUID (FK to profiles)
- exam_id: UUID (FK to exams)
- event_type: string
- confidence: numeric (0-1)
- metadata: JSON
- created_at: timestamp
```

---

## 📡 API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/logout` - Logout user

### Exam Management
- `GET /api/teacher/exams` - List teacher's exams
- `POST /api/teacher/exams` - Create exam
- `PUT /api/teacher/exams/:id` - Update exam
- `DELETE /api/teacher/exams/:id` - Delete exam

### Questions
- `GET /api/exams/:id/questions` - Get exam questions
- `POST /api/exams/:id/questions` - Add question
- `PUT /api/questions/:id` - Update question
- `DELETE /api/questions/:id` - Delete question

### Student Exams
- `GET /api/student/exams` - List student's exams
- `POST /api/student/exams/:id/start` - Start exam
- `POST /api/student/exams/:id/submit` - Submit answers

### Proctoring & Monitoring
- `POST /api/flag-event` - Log behavior flag
- `POST /api/detect-ai-writing` - Analyze AI content
- `POST /api/detect-collusion` - Detect collusion patterns
- `GET /api/teacher/monitor/:exam_id` - Monitor exam in real-time

### Reports & Analytics
- `GET /api/teacher/exam/:id/report` - Generate exam report
- `POST /api/generate-report` - Generate detailed PDF report
- `POST /api/grade-answers` - Grade submitted answers

### Student Invitations
- `POST /api/send-invites` - Send exam invitations
- `GET /api/invites/:token` - Validate invite

---

## 📁 Project Structure

```
proctor-app/
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── api/                      # API Routes
│   │   │   ├── flag-event/          # Log proctoring flags
│   │   │   ├── detect-ai-writing/   # AI detection
│   │   │   ├── detect-collusion/    # Collusion detection
│   │   │   ├── grade-answers/       # Answer grading
│   │   │   ├── generate-report/     # Report generation
│   │   │   └── send-invites/        # Email invitations
│   │   ├── auth/                     # Authentication pages
│   │   │   ├── login/
│   │   │   └── register/
│   │   ├── join/                     # Join exam via invite link
│   │   │   └── [token]/
│   │   ├── student/                  # Student pages
│   │   │   ├── dashboard/
│   │   │   ├── exam/
│   │   │   ├── home/
│   │   │   └── results/
│   │   ├── teacher/                  # Teacher pages
│   │   │   ├── exam/
│   │   │   │   ├── create/
│   │   │   │   ├── [id]/
│   │   │   │   │   ├── edit/
│   │   │   │   │   ├── invite/
│   │   │   │   │   ├── monitor/
│   │   │   │   │   └── report/
│   │   │   └── home/
│   │   ├── layout.tsx                # Root layout
│   │   ├── page.tsx                  # Home page
│   │   └── globals.css               # Global styles
│   ├── components/                   # Reusable components
│   │   ├── auth/                     # Auth components
│   │   ├── exam/                     # Exam components
│   │   │   ├── ExamMonitor.tsx      # Live monitoring
│   │   │   ├── ExamReport.tsx       # Report view
│   │   │   ├── ExamTaker.tsx        # Exam taking interface
│   │   │   ├── QuestionEditor.tsx   # Question management
│   │   │   ├── InviteManager.tsx    # Invite management
│   │   │   ├── MCQOptions.tsx       # MCQ rendering
│   │   │   └── Timer.tsx            # Exam timer
│   │   ├── layout/                   # Navigation
│   │   ├── student/                  # Student components
│   │   ├── ui/                       # Shadcn UI components
│   │   └── providers/                # Context providers
│   ├── hooks/                        # Custom React hooks
│   │   ├── useProctoring.ts         # Proctoring logic
│   │   ├── useExamTimer.ts          # Timer management
│   │   ├── useAutoSave.ts           # Auto-save functionality
│   │   └── useRealtimeFlags.ts      # Real-time flag updates
│   ├── lib/                          # Utilities & integrations
│   │   ├── supabase/
│   │   │   ├── server.ts            # Server client
│   │   │   ├── client.ts            # Browser client
│   │   │   └── middleware.ts        # Auth middleware
│   │   ├── ai-detection.ts          # AI writing detection
│   │   ├── grading.ts               # Answer grading logic
│   │   ├── gemini.ts                # Gemini API integration
│   │   ├── daily.ts                 # Daily.co integration
│   │   ├── pdf-report.ts            # PDF generation
│   │   ├── report-generator.ts      # Report logic
│   │   ├── resend.ts                # Email service
│   │   └── utils.ts                 # Helper functions
│   ├── types/                        # TypeScript types
│   │   ├── database.ts              # DB type definitions
│   │   ├── exam.ts                  # Exam types
│   │   └── proctoring.ts            # Proctoring types
│   ├── providers/                    # Context providers
│   │   └── SupabaseProvider.tsx
│   └── proxy.ts                      # Fetch proxy
├── public/                           # Static assets
│   ├── models/                       # ML models (face detection)
│   └── face_landmark_models/
├── package.json
├── tsconfig.json
├── next.config.ts
├── tailwind.config.ts
├── postcss.config.mjs
├── eslint.config.mjs
└── README.md
```

---

## 🔧 Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL | `https://xxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase public anon key | `eyJh...` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-side only) | `eyJh...` |
| `NEXT_PUBLIC_GOOGLE_API_KEY` | Google Cloud API key for Gemini | `AIza...` |
| `NEXT_PUBLIC_DAILY_API_KEY` | Daily.co API key (optional) | `xxx` |
| `RESEND_API_KEY` | Resend email service API key | `re_xxx` |
| `NEXT_PUBLIC_APP_URL` | Application URL | `http://localhost:3000` |

---

## 🚀 Deployment

### Option 1: Vercel (Recommended)
```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel

# Environment variables will be prompted
```

### Option 2: Docker
```bash
# Build image
docker build -t online-proctor .

# Run container
docker run -p 3000:3000 \
  -e NEXT_PUBLIC_SUPABASE_URL=xxx \
  -e NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx \
  online-proctor
```

### Option 3: Manual Server
```bash
# Build application
npm run build

# Start with process manager (PM2)
npm install -g pm2
pm2 start npm --name "proctor-app" -- start
pm2 startup
pm2 save
```

### Deployment Checklist
- [ ] Set all environment variables
- [ ] Enable CORS on Supabase
- [ ] Configure RLS policies (disabled by default)
- [ ] Set up Supabase backups
- [ ] Enable email verification (Supabase Auth)
- [ ] Test with production database
- [ ] Set up monitoring and error tracking
- [ ] Configure HTTPS/SSL

---

## 🎯 Key Features Explained

### 1. **Real-Time Monitoring Dashboard**
The teacher monitoring page displays:
- Live exam sessions with status indicators
- Real-time flag updates (proctoring violations)
- Student connectivity status
- Session duration tracking

**Technology**: Supabase Realtime subscriptions with React state management

### 2. **AI-Powered Cheating Detection**
Integrates Google Gemini API to:
- Analyze student answers for AI-written content
- Calculate confidence scores (0-100)
- Provide detailed analysis and recommendations
- Flag suspicious answers for teacher review

**Technology**: Google Generative AI API + custom prompt engineering

### 3. **Face Detection & Biometric Verification**
Uses face-api.js (TensorFlow.js) to:
- Detect face presence in webcam feed
- Track head position and gaze
- Alert if face leaves frame
- Detect multiple faces or unauthorized persons

**Flow**:
1. Student's webcam stream is analyzed locally in browser
2. Detection events are logged to `behavior_logs` table
3. Flags are created for suspicious behavior
4. Teachers see real-time alerts

### 4. **Auto-Save Functionality**
```typescript
// Custom hook saves answers every 30 seconds
useAutoSave(() => {
  supabase.rpc('update_exam_answers', {
    session_id, answers
  })
})
```

### 5. **PDF Report Generation**
Using `@react-pdf/renderer` to create detailed reports including:
- Student performance metrics
- Flag summary and severity breakdown
- AI detection results
- Behavioral analysis
- Teacher recommendations

---

## 📖 Usage Guide

### For Teachers

#### 1. Create an Exam
1. Navigate to Dashboard → "Create New Exam"
2. Fill in exam details:
   - Title, description, duration
   - Pass marks, pass percentage
   - Requirement settings (webcam, fullscreen)
   - Question shuffling preference
3. Add questions of different types:
   - **MCQ**: Add options and mark correct answer (stored as VALUE not LABEL)
   - **Short Answer**: Define expected answer and grading hint
   - **Long Answer**: Set grading rubric and marks
4. Save and activate exam

#### 2. Invite Students
1. Go to Exam → "Invite Students"
2. Enter student emails (comma-separated)
3. System generates unique invite links
4. Emails are sent via Resend service
5. Students click link to join

#### 3. Monitor Live Exam
1. During active exam, click "Monitor"
2. View real-time session data:
   - Students currently taking exam
   - Behavioral flags with confidence scores
   - Alert categories (face, collusion, etc.)
3. Click student name for detailed session view

#### 4. Review Results & Reports
1. After exam ends, click "Report"
2. View:
   - Student scores and performance
   - AI detection analysis
   - Flag summaries
   - Behavioral patterns
3. Generate and download PDF report

### For Students

#### 1. Join Exam
1. Receive invite email with unique link
2. Click link, authenticate if needed
3. Click "Start Exam"
4. Grant webcam permissions
5. Exam timer begins

#### 2. Take Exam
1. Read question and select/enter answer
2. Navigate between questions
3. Your answers auto-save every 30 seconds
4. Watch timer for remaining time
5. No pausing or leaving fullscreen allowed

#### 3. Submit & View Results
1. Click "Submit Exam" when finished
2. System automatically grades answers
3. View results page immediately:
   - Your score
   - Pass/Fail status
   - Detailed feedback per question
4. Download certificate (if passed)

---

## 🔒 Security Features

✅ **RLS (Row Level Security)**: RPC functions handle authorization internally  
✅ **CSRF Protection**: Built into Next.js  
✅ **XSS Prevention**: React's DOM sanitization + Type safety  
✅ **Secure Auth**: Supabase JWT tokens with refresh rotation  
✅ **Encrypted Transmission**: HTTPS/TLS for all data  
✅ **No Direct DB Access**: All queries through Supabase RPC functions  

---

## 🐛 Troubleshooting

### Common Issues

**1. Face detection not working**
- Ensure camera permissions are granted
- Check browser console for errors
- Verify models are loaded from `/public/models/`

**2. Auto-save not working**
- Check network tab in DevTools
- Verify Supabase RPC function exists
- Check user authentication status

**3. Email invites not sending**
- Verify Resend API key is set
- Check email addresses are valid
- Review Resend dashboard for failures

**4. AI detection API errors**
- Verify Google API key is valid
- Check daily API quota hasn't exceeded
- Ensure API is enabled in Google Cloud Console

---

## 📊 Performance Optimization

- **Server-Side Rendering**: Exam data fetched server-side
- **Image Optimization**: Next.js Image component for avatars
- **Code Splitting**: Dynamic imports for heavy components
- **Realtime Optimization**: Subscribed channels cleaned up on unmount
- **Database Indexing**: Proper indexes on foreign keys and frequently queried columns

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

---

## 📄 License

This project is proprietary and confidential. Unauthorized copying or distribution is prohibited.

---

## 📞 Support

For issues, questions, or feature requests:
- Create an issue on GitHub
- Email: support@onlineproctor.edu
- Documentation: Online help center (coming soon)

---

## 🎉 Acknowledgments

- **Next.js & Vercel**: Exceptional React framework
- **Supabase**: Amazing backend-as-a-service
- **Google Cloud**: Gemini API for AI detection
- **Face-api.js**: TensorFlow-based face recognition
- **Shadcn UI & Radix**: Beautiful component libraries

---

**Version**: 1.0.0  
**Last Updated**: March 17, 2026  
**Author**: Abdul Taufeeq  
**Repository**: [ONLINE-PROCTOR](https://github.com/AbdulTaufeeq01/ONLINE-PROCTOR)

---

## 📊 Quick Stats

- **Total Dependencies**: 30+
- **Lines of Code**: 5,000+
- **API Endpoints**: 15+
- **Database Tables**: 7
- **React Components**: 20+
- **Custom Hooks**: 4
- **Supported Question Types**: 3 (MCQ, Short Answer, Long Answer)

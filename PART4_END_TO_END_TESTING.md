# PART 4: END-TO-END FLOW TEST CHECKLIST

Follow this manual testing sequence to verify the complete exam system works end-to-end.

---

## ✅ PREREQUISITES

- [ ] All 18 files implemented and TypeScript errors fixed
- [ ] All RPC functions created in Supabase (from PART3_RPC_FUNCTIONS.sql)
- [ ] Environment variables configured (.env.local with NEXT_PUBLIC_* vars)
- [ ] Local development server running (`npm run dev`)
- [ ] Browser DevTools open to check Console for errors

---

## SECTION 1: TEACHER SETUP

### 1.1 Teacher Registration & Login
- [ ] Go to `http://localhost:3000/auth/register`
- [ ] Register with test email (e.g., `teacher@test.com`) and password
- [ ] Verify form validation (email format, password strength)
- [ ] Submit form
- [ ] **Expected**: Redirect to `/teacher/home` dashboard
- [ ] Verify: User authenticated (no redirect to login)

### 1.2 Teacher Dashboard
- [ ] On `/teacher/home`, verify page loads without errors
- [ ] Check Console: no TypeScript or runtime errors
- [ ] Verify "Create Exam" button visible
- [ ] If exams exist, verify exam list displays with:
  - [ ] Exam title
  - [ ] Question count
  - [ ] Session count
  - [ ] Completion percentage

### 1.3 Create Test Exam
- [ ] Click "Create Exam" button
- [ ] Fill exam form:
  - [ ] Title: "Practice Math Quiz"
  - [ ] Description: "Simple test"
  - [ ] Duration: 10 minutes
  - [ ] Pass Marks: 50
- [ ] Click "Create"
- [ ] **Expected**: Redirect to exam questions page

### 1.4 Add Exam Questions
- [ ] Add Question 1 (MCQ):
  - [ ] Type: Multiple Choice
  - [ ] Text: "What is 2 + 2?"
  - [ ] Options: A) 3, B) 4, C) 5, D) 6
  - [ ] Correct Answer: B
  - [ ] Marks: 1
- [ ] Add Question 2 (Short Answer):
  - [ ] Type: Short Answer
  - [ ] Text: "What is the capital of France?"
  - [ ] Correct Answer: "Paris"
  - [ ] Marks: 1
- [ ] Add Question 3 (Long Answer):
  - [ ] Type: Long Answer
  - [ ] Text: "Explain photosynthesis in 2-3 sentences"
  - [ ] Marks: 2
- [ ] Save all questions
- [ ] **Expected**: All 3 questions saved in order

### 1.5 Publish Exam
- [ ] Click "Publish Exam" button
- [ ] Verify status changes to "Active"
- [ ] **Expected**: Exam is now enrollable

### 1.6 Send Invites
- [ ] Click "Send Invites" button
- [ ] Enter student email: `student@test.com`
- [ ] Enter student name: "Test Student"
- [ ] Click "Send Invite"
- [ ] **Expected**: Success message shows
- [ ] Check email inbox (or Resend dashboard):
  - [ ] Email received with subject containing exam title
  - [ ] Email body contains:
    - [ ] Student name greeting
    - [ ] Exam title
    - [ ] Duration (10 minutes)
    - [ ] Join button/link
    - [ ] Security warnings about:
      - [ ] Webcam monitoring
      - [ ] Quiet environment
      - [ ] No tab switching
      - [ ] Auto-submit

### 1.7 Verify Invite Link
- [ ] Open email and copy join/invite link
- [ ] Link format should be: `http://localhost:3000/join/[TOKEN]`
- [ ] **Expected**: Token is a hex string (32 bytes = 64 chars)

---

## SECTION 2: STUDENT EXAM TAKING

### 2.1 Student Registration & Login (New Session)
- [ ] Open new incognito/private window
- [ ] Go to `http://localhost:3000/auth/register`
- [ ] Register with student email: `student@test.com`
- [ ] Login
- [ ] **Expected**: Redirect to `/student/home` dashboard

### 2.2 Join Exam via Invite Link
- [ ] Paste invite link in browser
- [ ] **Expected**: Redirect to `/student/exam/[ID]` page or join confirmation page
- [ ] If confirmation page:
  - [ ] Click "Accept" or "Join Exam"
- [ ] **Expected**: Redirect to exam page and session created

### 2.3 Pre-Exam Screen
- [ ] Verify "Ready to Start?" dialog shown
- [ ] Dialog text mentions:
  - [ ] Fullscreen requirement
  - [ ] Webcam monitoring
- [ ] Click "Enter Exam"
- [ ] If fullscreen enabled: browser request for fullscreen permission appears
  - [ ] Click "Allow" to enter fullscreen
- [ ] **Expected**: Fullscreen entered (if browser supports it)

### 2.4 Exam Loading
- [ ] Verify page loads exam content
- [ ] Check for these elements:
  - [ ] Timer in top bar (should show 10:00)
  - [ ] Exam title
  - [ ] Question 1 of 3
  - [ ] Webcam feed panel on right
  - [ ] Question navigator dots

### 2.5 Webcam Access
- [ ] Browser permission dialog appears: "Allow access to camera?"
- [ ] Click "Allow"
- [ ] **Expected**: 
  - [ ] Webcam stream appears in video element
  - [ ] Status changes from "Starting webcam..." to face detection status
  - [ ] May see "Loading AI models..." briefly

### 2.6 Face Detection Model Loading
- [ ] Wait for models to load (may take 3-5 seconds)
- [ ] **Expected**:
  - [ ] Status shows "Monitoring active" or face detection status
  - [ ] If face visible: "✓ Face detected"
  - [ ] If no face: "⚠️ No face detected" + warning overlay
- [ ] Position yourself so face is visible
- [ ] **Expected**: Warning disappears, status shows "✓ Face detected"

### 2.7 MCQ Question (Question 1)
- [ ] Question displays: "What is 2 + 2?"
- [ ] 4 options visible with A/B/C/D labels
- [ ] Click option B (4)
- [ ] **Expected**: 
  - [ ] Option B highlighted in blue
  - [ ] Navigator shows Q1 as answered (green dot)
  - [ ] Answer persisted in browser

### 2.8 Answer Persistence Check (Auto-Save)
- [ ] Wait 30 seconds
- [ ] Check Console: logs from auto-save should appear or HTTP requests in Network tab
- [ ] Click "Previous" button to go back
- [ ] Click "Next" button to return to Q1
- [ ] **Expected**: Answer (B) still selected

### 2.9 Short Answer Question (Question 2)
- [ ] Click "Next" to go to Q2
- [ ] Question displays: "What is the capital of France?"
- [ ] Type answer: "Paris"
- [ ] **Expected**: 
  - [ ] Text appears in textarea
  - [ ] Navigator shows Q2 as answered

### 2.10 Long Answer Question (Question 3)
- [ ] Click "Next" to go to Q3
- [ ] Question displays essay question about photosynthesis
- [ ] Type multi-sentence answer (2-3 sentences)
- [ ] Example: "Photosynthesis is the process by which plants convert light into chemical energy. It uses water and carbon dioxide to create glucose and oxygen."
- [ ] **Expected**: Text appears in large textarea

### 2.11 Tab Switch Detection
- [ ] From exam page, press Alt+Tab or click another browser tab
- [ ] **Expected**: 
  - [ ] Warning overlay appears: "Tab switch detected!"
  - [ ] Supabase flags table gets new entry with flag_type='tab_switch'
  - [ ] Click "I Understand" to dismiss warning
  - [ ] Continue with exam

### 2.12 Copy/Paste Prevention
- [ ] Try to copy text from question using Ctrl+C
- [ ] **Expected**: Warning shows "Copy-paste is not allowed"
- [ ] Try to paste using Ctrl+V
- [ ] **Expected**: Warning shows again, paste is blocked

### 2.13 Timer Countdown
- [ ] Verify timer starts at 10:00
- [ ] Timer counts down (decrements each second)
- [ ] At 5:00 remaining:
  - [ ] Timer color changes to yellow
  - [ ] Toast notification: "⏰ 5 minutes remaining!"
- [ ] At 1:00 remaining:
  - [ ] Timer color changes to red
  - [ ] Toast notification: "⏰ Less than 1 minute remaining!"
  - [ ] Timer may pulse/animate

### 2.14 Manual Submit (Before Timer Expires)
- [ ] Click "Submit Exam" button in bottom right
- [ ] **Expected**: Confirmation dialog appears
- [ ] Dialog shows:
  - [ ] "Are you sure you want to submit?"
  - [ ] Option to confirm/cancel
- [ ] Click "Yes, Submit"
- [ ] **Expected**:
  - [ ] Loading state: "Submitting..."
  - [ ] POST request to `/api/submit-exam`
  - [ ] Redirect to `/student/results/[SESSION_ID]`

### 2.15 Results Page
- [ ] Results page loads
- [ ] Display shows:
  - [ ] Exam title
  - [ ] Final score (e.g., "3 / 4")
  - [ ] Percentage (75%)
  - [ ] Pass/Fail badge
- [ ] Answer review section shows:
  - [ ] Each question
  - [ ] Student answer
  - [ ] Correct answer
  - [ ] Marks received
  - [ ] Feedback (if provided)
- [ ] MCQ shows: "✓ Correct" or "✗ Incorrect"
- [ ] Subjective answers show Gemini AI feedback (if graded)

---

## SECTION 3: TEACHER MONITORING (During Student Exam)

** Complete in PARALLEL with student exam taking **

### 3.1 Monitor Page
- [ ] In teacher browser, go to `/teacher/exam/[EXAM_ID]/monitor`
- [ ] While student is taking exam:
  - [ ] Student appears in live table
  - [ ] Status shows "In Progress"
  - [ ] Timer shows student's remaining time
  - [ ] Flag count updates in real-time

### 3.2 Real-Time Flag Updates
- [ ] Have student switch tabs (from exam window)
- [ ] On monitor page:
  - [ ] Activity feed update appears immediately
  - [ ] Shows "Tab switch detected by [student name]"
  - [ ] Flag count increments

### 3.3 Behavior Log
- [ ] Activity feed shows entries for:
  - [ ] Tab switches
  - [ ] Face events (if any face issues)
  - [ ] Any other detected behavior

---

## SECTION 4: TEACHER REPORT

### 4.1 Access Report Page
- [ ] After student submits exam, go to `/teacher/exam/[EXAM_ID]/report`
- [ ] Report page loads without errors

### 4.2 Exam Statistics
- [ ] Statistics cards display:
  - [ ] Total Students: 1
  - [ ] Completed: 1
  - [ ] Average Score: 3 / 4 (based on test)
  - [ ] Avg Cheating Score: (shows value)

### 4.3 Student Table
- [ ] Student table shows student row with columns:
  - [ ] Name: "Test Student"
  - [ ] Email: "student@test.com"
  - [ ] Status: "Submitted"
  - [ ] Score: "3 / 4" (green, passing)
  - [ ] Cheating Score: (if calculated)
  - [ ] Flags: "1" (badge showing flag count)

### 4.4 Select Student Details
- [ ] Click "View Details" button for student
- [ ] Right panel loads with:
  - [ ] Student info (name, email, timestamps)
  - [ ] Score and Pass/Fail badge
  - [ ] Cheating score (if available)
  - [ ] AI Report section (if grading completed)
  - [ ] Security Flags section

### 4.5 Flag Explanations (Human-Readable)
- [ ] In Security Flags section:
  - [ ] Verify flag type is human-readable (NOT raw "tab_switch")
  - [ ] Expected: "Tab Switch" or "Student Switched Tabs"
  - [ ] Severity badge shows (e.g., MEDIUM)
  - [ ] Description explains the flag
  - [ ] Evidence bullets show details
  - [ ] Suggested action shown

### 4.6 Collusion Detection
- [ ] Click "Run Collusion Check" button
- [ ] Loading state appears
- [ ] **Expected**: 
  - [ ] Check completes (single student, so no collusion)
  - [ ] Message: "Found 0 potential collusion pair(s)"
  - [ ] Results table is empty

---

## SECTION 5: ERROR CASES & EDGE CONDITIONS

### 5.1 Expired Invite Link
- [ ] Open invite link again (already used)
- [ ] **Expected**: Error message "This invite has been used already"

### 5.2 Unauthenticated Access
- [ ] Log out from student account
- [ ] Try to access `/student/exam/[ID]` directly
- [ ] **Expected**: Redirect to `/auth/login`

### 5.3 Teacher Access Student Pages
- [ ] Log out student, log in as teacher
- [ ] Try to access `/student/dashboard`
- [ ] **Expected**: Redirect to `/teacher/home` (based on role)

### 5.4 Student Access Teacher Pages
- [ ] Log out teacher, log in as student
- [ ] Try to access `/teacher/home`
- [ ] **Expected**: Either 403 error or redirect to `/student/home`

### 5.5 Timer Expiry Auto-Submit
- [ ] Start new exam with 1 minute duration
- [ ] Do NOT click submit
- [ ] Wait for timer to reach 0:00
- [ ] **Expected**:
  - [ ] Auto-submit triggered
  - [ ] Redirect to results page
  - [ ] Results show score from auto-attempt

### 5.6 Webcam Permission Denied
- [ ] Start new exam
- [ ] When browser requests camera, click "Block"
- [ ] **Expected**:
  - [ ] Error message: "Camera access denied..."
  - [ ] Warning shown: "Allow camera in browser settings"
  - [ ] Exam continues (camera not required for submission)

### 5.7 Network Error During Auto-Save
- [ ] Start exam
- [ ] Open DevTools Network tab
- [ ] Set Network to "Offline"
- [ ] Try to type answer
- [ ] Wait 30+ seconds (auto-save attempt fails)
- [ ] Set Network back to "Online"
- [ ] **Expected**: 
  - [ ] Auto-save eventually succeeds when online
  - [ ] OR manual save button tries again

---

## SECTION 6: ADVANCED SCENARIOS (Optional)

### 6.1 Question Shuffling
- [ ] If exam has shuffle_questions=true:
- [ ] Two separate students taking same exam see questions in different order
- [ ] Verify navigator dots show correct order per student

### 6.2 Eye Tracking
- [ ] If eye_tracking_enabled=true in exam settings:
- [ ] Look away from screen
- [ ] **Expected**: Warning "Please keep your eyes on the screen"

### 6.3 Phone Detection
- [ ] If phone_detection_enabled=true:
- [ ] Tilt head significantly to side
- [ ] **Expected**: Flag logged for head tilt

### 6.4 Multiple Students
- [ ] Repeat student exam-taking (Section 2) with 2nd student
- [ ] Have both students active simultaneously
- [ ] Monitor page shows both in live table
- [ ] Flags appear for both

### 6.5 Collusion Check with Multiple Students
- [ ] After both students submit with similar answers
- [ ] Click "Run Collusion Check"
- [ ] **Expected**: 
  - [ ] Analyzes all student pairs
  - [ ] If answers are very similar (>0.85 cosine similarity):
    - [ ] Pair appears in results table
    - [ ] Similarity score shown
    - [ ] Verdict displayed (e.g., "highly_similar")

---

## SECTION 7: FINAL VERIFICATION

### 7.1 Database Checks
- [ ] Go to Supabase Dashboard
- [ ] Check `exam_sessions` table:
  - [ ] Entry exists with submitted_at timestamp
  - [ ] Status = "submitted"
  - [ ] Score and answers populated
- [ ] Check `flags` table:
  - [ ] Tab switch flag created
  - [ ] Severity set correctly
  - [ ] Metadata populated
- [ ] Check `behavior_logs` table:
  - [ ] Entries for tab switches and other events
  - [ ] Confidence and metadata logged

### 7.2 Console Errors
- [ ] Verify NO errors in browser Console
- [ ] Warnings are acceptable, errors are not
- [ ] Check both student and teacher browsers

### 7.3 Network Activity
- [ ] In Network tab, verify successful requests:
  - [ ] `/api/flag-event` - POST 200
  - [ ] `/api/submit-exam` - POST 200
  - [ ] `/api/grade-answers` - POST 200 (if used)
  - [ ] `/api/detect-collusion` - POST 200 (if run)

### 7.4 Performance
- [ ] Exam page loads in <2 seconds
- [ ] Auto-save requests complete in <1 second
- [ ] Collusion check completes in <5 seconds

---

## TEST RESULT SUMMARY

**Record your results**:

| Component | Status | Notes |
|-----------|--------|-------|
| Teacher Registration | ✅ / ❌ | |
| Exam Creation & Publishing | ✅ / ❌ | |
| Student Invites (Email) | ✅ / ❌ | |
| Student Login & Join | ✅ / ❌ | |
| Fullscreen & Webcam | ✅ / ❌ | |
| MCQ Answering | ✅ / ❌ | |
| Text Answering | ✅ / ❌ | |
| Timer Countdown | ✅ / ❌ | |
| Tab Switch Detection | ✅ / ❌ | |
| Copy/Paste Prevention | ✅ / ❌ | |
| Auto-Submit on Expiry | ✅ / ❌ | |
| Manual Submit | ✅ / ❌ | |
| Results Display | ✅ / ❌ | |
| Flag Explanations | ✅ / ❌ | |
| Collusion Detection | ✅ / ❌ | |
| Real-Time Monitoring | ✅ / ❌ | |
| Error Handling | ✅ / ❌ | |
| Performance | ✅ / ❌ | |

---

## Troubleshooting

**If tests fail**, consult the troubleshooting guide:

1. **Models not loading**
   - [ ] Verify `/public/models/` contains all .bin files
   - [ ] Check browser Console for specific model loading errors
   - [ ] May take 3-5 seconds; don't expect instant loading

2. **Auto-save not working**
   - [ ] Check Network tab for requests to `/api/submit-exam`
   - [ ] Verify sessionId is set (check React DevTools)
   - [ ] Check /api/submit-exam implementation logs

3. **Webcam black screen**
   - [ ] Check camera is not already in use
   - [ ] Try reloading page
   - [ ] Check System Preferences > Security & Privacy > Camera
   - [ ] Ensure camera has red light indicator (physically working)

4. **Flags not appearing**
   - [ ] Check `/api/flag-event` is returning 200
   - [ ] Verify Supabase flags table has permission to INSERT
   - [ ] Check Supabase Realtime is enabled

5. **Timer stuck**
   - [ ] Refresh page
   - [ ] Check browser Console for JavaScript errors (interval not clearing)
   - [ ] Verify started_at timestamp is correct

---

**All tests passing?** Proceed to deployment!

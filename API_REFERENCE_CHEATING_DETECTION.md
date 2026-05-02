# API Reference - Cheating Detection

## 🔗 Endpoints Summary

### 1. `/api/flag-event` (Existing - Fixed)
**Method:** POST  
**Purpose:** Record individual proctoring flag events  
**Fixed:** RPC parameter names now use `_param` suffix

```bash
POST /api/flag-event
Content-Type: application/json

{
  "session_id": "session-uuid",
  "student_id": "student-uuid",
  "exam_id": "exam-uuid",
  "event_type": "tab_switch" | "face_not_detected" | "multiple_faces" | "paste_detected" | "fullscreen_exit" | "noise_detected",
  "confidence": 0.85,  // 0-1
  "metadata": { /* varies by event_type */ },
  "severity": "low" | "medium" | "high",
  "log_type": "flag_event"
}

Response: { success: true, message: "Flag recorded", flag_id: "..." }
```

---

### 2. `/api/behavioral-logs` (NEW)
**Method:** POST  
**Purpose:** Store detailed keystroke, paste, and focus behavioral data  
**Auto-calculates risk score from patterns**

```bash
POST /api/behavioral-logs
Content-Type: application/json

{
  "session_id": "session-uuid",
  "student_id": "student-uuid",
  "exam_id": "exam-uuid",
  "question_id": "question-uuid",
  "tab_switches": 0,
  "paste_events": [
    { "timestamp": 1699564800000, "charCount": 150 }
  ],
  "keystroke_timeline": [
    { "timestamp": 1699564800000, "charCount": 85, "duration": 2000 }
  ],
  "mouse_leave_events": 0,
  "focus_loss_events": 1,
  "window_blur_count": 2,
  "total_time_seconds": 300,
  "suspicious_patterns": ["Large paste detected: 150 characters"]
}

Response: {
  success: true,
  risk_score: 25,  // 0-100
  risk_level: "low",
  message: "Behavioral log recorded"
}
```

---

### 3. `/api/analyze-behavior` (Updated)
**Method:** POST  
**Purpose:** Calculate combined cheating score from all flags and patterns  
**Returns:** 0-100 integer (NOT percentage)

```bash
POST /api/analyze-behavior
Content-Type: application/json

{
  "session_id": "session-uuid",
  "exam_id": "exam-uuid",
  "student_id": "student-uuid",
  "include_behavior_logs": true,  // optional
  "ai_writing_score": 15  // optional, 0-100
}

Response: {
  success: true,
  cheating_score: 28,  // Integer 0-100, NOT percentage!
  risk_level: "low",
  breakdown: {
    flags_score: 50,
    pattern_score: 20,
    ai_writing_score: 15,
    weighted_score: 28
  },
  explanation: "..."
}
```

---

### 4. `/api/combined-risk` (NEW)
**Method:** POST  
**Purpose:** Calculate collusion risk combining semantic similarity + behavior  
**For comparing two students' answers**

```bash
POST /api/combined-risk
Content-Type: application/json

{
  "question_id": "question-uuid",
  "student_a": {
    "id": "student-a-uuid",
    "answer": "The answer text from student A...",
    "behavioral_score": 15  // optional, 0-100
  },
  "student_b": {
    "id": "student-b-uuid",
    "answer": "The answer text from student B...",
    "behavioral_score": 8   // optional, 0-100
  }
}

Response: {
  success: true,
  similarity_score: 0.89,      // 0-1 from embeddings
  similarity_percentage: 89,   // 0-100 for display
  behavioral_score: 12,        // Average of both students
  final_risk_score: 72,        // 0-100
  final_risk_percentage: 72,   // 0-100 for display
  risk_level: "high",          // critical|high|medium|low
  teacher_verdict: "High similarity detected. Students likely shared answers or used similar sources.",
  flagged_for_review: true,
  explanation: "..."
}
```

---

## 📊 Risk Level Mappings

### Cheating Score (Single Student)
| Range | Level | Color | Meaning |
|-------|-------|-------|---------|
| 0-20 | Low | 🟢 Green | Minimal suspicious behavior |
| 21-45 | Moderate | 🟡 Yellow | Some concerning patterns |
| 46-70 | High | 🟠 Orange | Multiple red flags |
| 71-100 | Critical | 🔴 Red | Strong evidence of cheating |

### Combined Risk (Collusion)
| Range | Level | Color | Meaning |
|-------|-------|-------|---------|
| 0-54 | Low | 🟢 Green | Answers appear independent |
| 55-69 | Medium | 🟡 Yellow | Possible collaboration |
| 70-84 | High | 🟠 Orange | Likely copied or shared |
| 85-100 | Critical | 🔴 Red | Almost certainly copied |

---

## 🧮 Scoring Calculations

### Behavioral Score Components
```
tab_switch: each event = 2 points (max 20)
face_not_detected: each event = 5 points (max 25)
multiple_faces: each event = 15 points (max 30)
paste_detected: each event = 8 points (max 32)
fullscreen_exit: each event = 5 points (max 15)
noise_detected: = 20 points
speed_anomaly: each = 5 points (max 15)

Total = min(100, sum)
```

### Cheating Score Formula
```
cheating_score = min(100, round(
  flagScore × 0.40 +      // 40% behavioral flags
  patternScore × 0.35 +   // 35% pattern analysis
  aiWritingScore × 0.25   // 25% AI content detection
))
```

### Combined Risk Formula (Collusion)
```
normalizedSimilarity = min(1.0, similarity_score)
normalizedBehavior = min(1.0, average_behavioral_score / 100)

combined = 
  normalizedSimilarity × 0.60 +    // 60% text similarity
  normalizedBehavior × 0.40        // 40% behavioral risk

final_risk_score = min(100, round(combined × 100))
```

---

## 🔐 Authentication

All endpoints use **service role authentication** (bypass RLS):
- Uses `SUPABASE_SERVICE_ROLE_KEY` from environment
- Credentials already included in route handlers
- No additional auth headers needed from client

---

## 💡 Usage Examples

### Capturing Enhanced Behavior
```typescript
const hook = useEnhancedProctoring(sessionId, questionId)

// On exam completion:
await hook.submitLog(studentId, examId)

// Check current analysis:
const analysis = hook.analyzeCurrentBehavior()
console.log(analysis.warnings)  // ["Large paste detected: 150 characters"]
```

### Comparing Two Answers
```typescript
const comparison = await fetch('/api/combined-risk', {
  method: 'POST',
  body: JSON.stringify({
    question_id,
    student_a: { id: 'a', answer: '...' },
    student_b: { id: 'b', answer: '...' }
  })
})

const result = await comparison.json()
if (result.risk_level === 'high') {
  console.log(result.teacher_verdict)  // "Likely copied or shared"
}
```

---

## 🐛 Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| HTTP 500 on flag-event | RPC param names wrong | Use `p_*_param` suffix |
| 2900% cheating score | Display multiplying by 100 | Remove the ×100, just use number |
| No flags recorded | Cooldown too high | Reduce from 3000ms to 500ms temporarily |
| Similarity always 0 | Embeddings not generated | Call Gemini API to get embeddings |
| Wrong risk level | Score not normalized | Ensure behavioral/100, similarity already 0-1 |

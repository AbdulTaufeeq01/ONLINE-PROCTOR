# Cheating Detection & Behavioral Scoring Integration Guide

## 📋 Overview

This implementation adds comprehensive cheating detection by combining three scoring mechanisms:

1. **Behavioral Scoring** - Flags from proctoring (tab switches, face detection, paste events)
2. **Semantic Similarity** - Answer comparison using embeddings
3. **Combined Risk** - Unified risk score for collusion detection

---

## 🔧 Files Created/Modified

### New Files:

| File | Purpose |
|------|---------|
| `src/lib/behavioral-scoring.ts` | Utility functions for behavioral scoring |
| `src/app/api/combined-risk/route.ts` | API endpoint for combined risk calculation |
| `src/app/api/behavioral-logs/route.ts` | API endpoint for detailed behavioral logging |
| `src/hooks/useEnhancedProctoring.ts` | React hook for capturing enhanced behavioral data |
| `src/components/teacher/CollisionReport.tsx` | Teacher dashboard component for collusion review |

### Modified Files:

| File | Change |
|------|--------|
| `src/app/api/analyze-behavior/route.ts` | Fixed cheating_score calculation (0-100 scale) |

---

## 🧮 Scoring Formulas

### 1. Behavioral Score Calculation

```
tab_switch_score = min(20, tab_switches × 2)
face_detection_score = min(25, face_absences × 5) + min(30, multiple_faces × 15)
paste_score = min(32, paste_events × 8)
fullscreen_score = min(15, fullscreen_exits × 5)
noise_score = noise_locked ? 20 : 0
speed_anomaly_score = min(15, speed_anomalies × 5)

total = min(100, sum of all scores)
```

**Risk Levels:**
- 75+ → Critical
- 50-74 → High
- 25-49 → Moderate
- < 25 → Low

### 2. Cheating Score (Behavioral + Patterns + AI)

```
flagScore = min(100, sum of all flag point values)
patternScore = min(100, tab_burst + extended_absence + multiple_faces + paste + noise + speed)
aiWritingScore = result from AI content detection

cheatingScore = min(100, round(
  flagScore × 0.40 +
  patternScore × 0.35 +
  aiWritingScore × 0.25
))
```

**Risk Levels:**
- 71-100 → Critical
- 46-70 → High
- 21-45 → Moderate
- 0-20 → Low

### 3. Combined Risk (for Collusion)

```
normalizedSimilarity = min(1, semantic_similarity_score)
normalizedBehavioral = min(1, avg_behavioral_score / 100)

finalRisk = min(1, 
  normalizedSimilarity × 0.60 +
  normalizedBehavioral × 0.40
)

# Display as percentage: finalRisk × 100
```

**Risk Levels:**
- 85-100% → Critical (likely copied)
- 70-84% → High (highly suspicious)
- 55-69% → Medium (needs review)
- < 55% → Low (likely independent)

---

## 💻 Integration Steps

### Step 1: Fix Display Bug (CRITICAL)

The cheating_score is now correctly stored as 0-100. When displaying:

```typescript
// ✅ CORRECT - displays "10%" for a score of 10
<span className="text-2xl font-bold">
  {cheating_score}%
</span>

// ❌ WRONG - displays "1000%" or "2900%"
<span className="text-2xl font-bold">
  {(cheating_score * 100)}%  // Don't multiply!
</span>

// ❌ WRONG - displays "1000"
<span className="text-2xl font-bold">
  {cheating_score * 100}
</span>
```

Find all teacher report pages that display `cheating_score` and ensure they're only displaying the number with a % sign, NOT multiplying by 100 again.

---

### Step 2: Add Enhanced Behavioral Tracking to ExamTaker

In `src/components/student/ExamTaker.tsx`, import and use the enhanced hook:

```typescript
import { useEnhancedProctoring } from '@/hooks/useEnhancedProctoring'

export function ExamTaker({ exam, session, questions, invite }: Props) {
  // ... existing code ...

  const enhancedTracking = useEnhancedProctoring(session.id, currentQuestion.id)

  // When exam is submitted, send the behavioral log:
  const handleSubmitExam = async () => {
    // ... existing submit logic ...
    
    await enhancedTracking.submitLog(session.student_id, exam.id)
  }

  // Optional: Show warning if suspicious behavior detected
  const behaviorAnalysis = enhancedTracking.analyzeCurrentBehavior()
  if (behaviorAnalysis.riskLevel === 'high') {
    console.warn('High behavioral risk detected:', behaviorAnalysis.warnings)
  }
}
```

---

### Step 3: Add Collusion Report to Teacher Dashboard

In your teacher exam report page (e.g., `src/app/teacher/exam/[id]/report/page.tsx`):

```typescript
import { CollisionReport } from '@/components/teacher/CollisionReport'

export default async function TeacherExamReportPage() {
  // ... fetch exam data, sessions, etc ...

  const sessionReports = [] // Your session data with collusion flags

  return (
    <div>
      {/* Existing exam summary... */}
      
      {/* Add collusion report section */}
      <div className="mt-8">
        <CollisionReport 
          examId={exam.id} 
          sessionReports={sessionReports}
        />
      </div>
    </div>
  )
}
```

---

### Step 4: Use Combined Risk API (Optional)

For real-time collusion checking when comparing two specific answers:

```typescript
const comparisonResult = await fetch('/api/combined-risk', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    question_id: 'q-123',
    student_a: {
      id: 'student-1',
      answer: 'Their answer text...',
      behavioral_score: 15  // Optional, defaults to 0
    },
    student_b: {
      id: 'student-2',
      answer: 'Their answer text...',
      behavioral_score: 8   // Optional, defaults to 0
    }
  })
})

const result = await comparisonResult.json()
// Returns: {
//   final_risk_score: 72,
//   risk_level: 'high',
//   teacher_verdict: '...',
//   flagged_for_review: true,
//   ...
// }
```

---

## 📊 Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│ STUDENT EXAM-TAKING                                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  useProctoring (existing)        useEnhancedProctoring     │
│  ├─ Tab switches          ┌────────┬──► Keystroke events   │
│  ├─ Face detection        │        ├──► Paste events       │
│  ├─ Clipboard paste   ────┤        ├──► Focus loss         │
│  └─ Copy attempts         │        └──► Mouse events       │
│                           │                                 │
│                           └──► /api/flag-event             │
│                           └──► /api/behavioral-logs        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ BACKEND ANALYSIS                                            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  flags table + behavior_logs table                          │
│                 │                                           │
│                 ▼                                           │
│  /api/analyze-behavior                                      │
│  ├─ Calculates: flagScore, patternScore, aiWritingScore    │
│  ├─ Formula: score = (flag×0.40) + (pattern×0.35) + (ai×0.25)│
│  └─ Updates: exam_sessions.cheating_score (0-100)         │
│                                                              │
│  /api/combined-risk (for collusion pairs)                  │
│  ├─ Gets: semantic_similarity, behavioral_score            │
│  ├─ Formula: risk = (sim×0.60) + (behav×0.40)             │
│  └─ Returns: final_risk_score (0-100), risk_level         │
│                                                              │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ TEACHER DASHBOARD                                           │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Behavior & Integrity Section                               │
│  ├─ Total Flags: 3                                         │
│  ├─ Cheating Risk Score: 28% (GREEN)                       │
│  └─ Flag Types: tab_switch ×3                              │
│                                                              │
│  Collusion Report Component                                 │
│  ├─ Flagged Pairs: 2                                       │
│  ├─ Critical Risk: 1                                       │
│  └─ Pair Details (expandable)                              │
│     ├─ Student A ↔ Student B: 87% similar                  │
│     ├─ Verdict: CRITICAL - likely copied                   │
│     └─ Actions: Review, Mark Reviewed                      │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 🎯 Testing Checklist

- [ ] Tab switches are recorded and appear in flags table
- [ ] Face detection events create flags with correct severity
- [ ] Paste events trigger `/api/flag-event` with correct payload
- [ ] Cheating score displays correctly (e.g., "28%" not "2800%")
- [ ] Risk level color-codes correctly (green/yellow/orange/red)
- [ ] Behavioral log API accepts keystroke/paste/focus data
- [ ] Combined risk API returns correct scores
- [ ] Collusion report component displays flagged pairs
- [ ] Filter buttons work (all/flagged/high/critical)
- [ ] Expandable rows show analysis details

---

## 🐛 Troubleshooting

### Cheating Score shows wrong percentage
- **Cause**: Display code is multiplying by 100
- **Fix**: Remove the `* 100` from display, just use `${cheating_score}%`

### Flags not appearing in database
- **Cause**: RPC function parameters have wrong names
- **Fix**: Use `p_*_param` suffix (e.g., `p_flag_type_param` not `p_flag_type`)

### Combined risk shows unexpected values
- **Cause**: Scores not normalized to 0-1 range
- **Fix**: Ensure `normalizedBehavioral = min(1, behavioral_score / 100)`

### Enhanced behavioral tracking not capturing events
- **Cause**: Event listeners not attached
- **Fix**: Ensure `useEnhancedProctoring` is called early in component lifecycle

---

## 📝 Database Considerations

The system uses existing tables:
- `flags` - stores proctoring events
- `behavior_logs` - stores detailed behavioral data
- `exam_sessions` - stores `cheating_score` and `ai_report`

No migrations needed. To extend, add a `collision_reports` table later if needed.

---

## 🔒 Security Notes

- Service role key used for backend API calls (bypass RLS)
- Behavioral data is logged server-side only
- Cheating scores stored in `exam_sessions` accessible only by teacher
- Combined risk calculations are deterministic and auditable

---

## 📞 Support

For issues:
1. Check browser console for `[proctoring]` logs
2. Check server logs for `[analyze-behavior]`, `[flag-event]`, `[combined-risk]` logs
3. Verify RPC function parameters use `_param` suffix
4. Verify cheating_score is integer 0-100, not percentage

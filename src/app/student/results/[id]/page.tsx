import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { ExamSession, Exam } from '@/types/database'

export const dynamic = 'force-dynamic'

export default async function ResultsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // ── Fetch session directly ────────────────────────────────────────────────
  const { data: session, error: sessionError } = await (supabase.from('exam_sessions') as any)
    .select('id, exam_id, student_id, status, answers, started_at, submitted_at, score, max_score, cheating_score, grading_details, ai_report')
    .eq('id', id)
    .eq('student_id', user.id)
    .single() as { data: ExamSession | null; error: any }

  if (!session || sessionError) redirect('/student/home')

  // ── Trigger AI grading if any question still needs it ─────────────────────
  const hasUngradedQuestions =
    !session.grading_details ||
    Object.keys(session.grading_details).length === 0 ||
    Object.values(session.grading_details as Record<string, any>).some(
      (d: any) => d.needs_grading === true || d.marks_awarded === null
    )

  if (hasUngradedQuestions) {
    try {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

      const gradeRes = await fetch(`${baseUrl}/api/grade-answers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Pass user id in body so grade-answers can verify ownership
        // without needing cookie forwarding
        body: JSON.stringify({ session_id: id, user_id: user.id }),
      })

      const gradeData = await gradeRes.json()
      console.log('grade-answers result:', gradeData)

      // Re-fetch session to get updated scores after grading
      const { data: updatedSession } = await (supabase.from('exam_sessions') as any)
        .select('id, exam_id, student_id, status, answers, started_at, submitted_at, score, max_score, cheating_score, grading_details, ai_report')
        .eq('id', id)
        .eq('student_id', user.id)
        .single() as { data: ExamSession | null; error: any }

      if (updatedSession) {
        Object.assign(session, updatedSession)
      }
    } catch (err) {
      console.error('Auto-grading failed:', err)
    }
  }

  // ── Fetch exam directly ───────────────────────────────────────────────────
  const { data: exam } = await (supabase.from('exams') as any)
    .select('id, title, pass_marks, duration_minutes')
    .eq('id', session.exam_id)
    .single() as { data: Exam | null; error: any }

  // ── Fetch questions directly ──────────────────────────────────────────────
  const { data: rawQuestions } = await (supabase.from('questions') as any)
    .select('id, order_index, type, question_text, options, correct_answer, marks, grading_hint')
    .eq('exam_id', session.exam_id)
    .order('order_index', { ascending: true })

  const questions = (rawQuestions ?? []).map((q: any) => {
    let options = null
    if (q.options) {
      let parsed = q.options
      if (typeof q.options === 'string') {
        try { parsed = JSON.parse(q.options) } catch { parsed = [] }
      }
      options = Array.isArray(parsed)
        ? parsed.map((o: any) => (typeof o === 'object' ? o.value : o))
        : null
    }
    return { ...q, options }
  })

  // ── Fetch flags directly ──────────────────────────────────────────────────
  const { data: flags } = await (supabase.from('flags') as any)
    .select('id, flag_type, severity, created_at, metadata')
    .eq('session_id', id)
    .order('created_at', { ascending: false })

  const { data: behaviorLogs } = await (supabase.from('behavior_logs') as any)
    .select('id, event_type, confidence, created_at, metadata')
    .eq('session_id', id)
    .order('created_at', { ascending: false })

  // If behavior exists but score is still zero/null, force a synchronous
  // analyze-behavior run so the user sees the updated risk score immediately.
  const hasBehavioralEvidence = (flags?.length ?? 0) > 0 || (behaviorLogs?.length ?? 0) > 0
  if ((session.cheating_score == null || session.cheating_score === 0) && hasBehavioralEvidence) {
    try {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
      await fetch(`${baseUrl}/api/analyze-behavior`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: id }),
      })

      const { data: rescoredSession } = await (supabase.from('exam_sessions') as any)
        .select('id, exam_id, student_id, status, answers, started_at, submitted_at, score, max_score, cheating_score, grading_details, ai_report')
        .eq('id', id)
        .eq('student_id', user.id)
        .single() as { data: ExamSession | null; error: any }

      if (rescoredSession) {
        Object.assign(session, rescoredSession)
      }
    } catch (err) {
      console.error('Analyze-behavior sync trigger failed:', err)
    }
  }

  // ── Derived values ────────────────────────────────────────────────────────
  const scorePercentage =
    session.max_score > 0
      ? ((session.score / session.max_score) * 100).toFixed(1)
      : '0'

  const isPassed = exam?.pass_marks
    ? session.score >= exam.pass_marks
    : parseFloat(scorePercentage) >= 50

  const timeTaken =
    session.started_at && session.submitted_at
      ? Math.round(
          (new Date(session.submitted_at).getTime() -
            new Date(session.started_at).getTime()) /
            60000
        )
      : 0

  const flagTypeCounts: Record<string, number> = {}
  for (const flag of (flags ?? []) as any[]) {
    const key = flag.flag_type ?? flag.event_type ?? 'unknown'
    flagTypeCounts[key] = (flagTypeCounts[key] ?? 0) + 1
  }

  // Include only behavior-only logs to avoid double-counting events
  // that already exist in flags (tab_switch, no_face, fullscreen_exit, etc.).
  const behaviorOnlyEventTypes = new Set([
    'loud_sound',
    'voice_detected',
    'noise_exam_locked',
    'answer_speed_anomaly',
  ])

  for (const log of (behaviorLogs ?? []) as any[]) {
    const key = log.event_type ?? 'unknown'
    if (behaviorOnlyEventTypes.has(key)) {
      flagTypeCounts[key] = (flagTypeCounts[key] ?? 0) + 1
    }
  }

  // Support both legacy 0-1 scale and current 0-100 scale
  const cheatingScoreValue =
    typeof session.cheating_score === 'number'
      ? (session.cheating_score <= 1 ? session.cheating_score * 100 : session.cheating_score)
      : 0

  const severityWeights: Record<string, number> = {
    critical: 25,
    high: 15,
    medium: 8,
    low: 3,
  }

  const flagSeverityMap: Record<string, string> = {
    multiple_faces: 'critical',
    no_face: 'high',
    copy_paste: 'high',
    noise_exam_locked: 'high',
    tab_switch: 'medium',
    window_blur: 'medium',
    fullscreen_exit: 'medium',
    loud_sound: 'medium',
    voice_detected: 'medium',
    eye_away: 'low',
    phone_suspected: 'low',
    copy_attempt: 'low',
  }

  const localFlagScore = (flags ?? []).reduce((sum: number, flag: any) => {
    const severity = flag.severity ?? flagSeverityMap[flag.flag_type] ?? 'low'
    return sum + (severityWeights[severity] ?? 3)
  }, 0)

  const localBehaviorScore = (behaviorLogs ?? []).reduce((sum: number, log: any) => {
    if (log.event_type === 'noise_exam_locked') return sum + 20
    if (log.event_type === 'answer_speed_anomaly') return sum + 15
    if (log.event_type === 'loud_sound' || log.event_type === 'voice_detected') return sum + 8
    return sum
  }, 0)

  const fallbackCheatingScore = Math.min(100, Math.round(localFlagScore + localBehaviorScore))
  const displayCheatingScore = cheatingScoreValue > 0 ? cheatingScoreValue : fallbackCheatingScore

  const gradingDetails = (session.grading_details as Record<string, any>) ?? {}

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white">
        <div className="max-w-4xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Exam Results</h1>
              <p className="text-gray-600 mt-1">{exam?.title}</p>
            </div>
            <a href="/student/home" className="text-blue-600 hover:text-blue-700 font-medium">
              ← Back to Home
            </a>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Score Card */}
        <div className="bg-white rounded-lg shadow-md p-8 mb-8">
          <div className="grid grid-cols-2 gap-8">
            <div>
              <div className="text-5xl font-bold text-blue-600">
                {session.score}/{session.max_score}
              </div>
              <p className="text-gray-600 mt-2">Score</p>
            </div>
            <div>
              <div className="text-5xl font-bold text-gray-800">
                {scorePercentage}%
              </div>
              <p className="text-gray-600 mt-2">Percentage</p>
            </div>
          </div>

          <div className="mt-8 pt-8 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600">Status</p>
                <div className="mt-2">
                  <span
                    className={`inline-block px-4 py-2 rounded-full font-semibold ${
                      isPassed
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {isPassed ? '✓ Passed' : '✗ Failed'}
                  </span>
                </div>
              </div>
              <div>
                <p className="text-gray-600">Time Taken</p>
                <p className="text-2xl font-bold text-gray-900 mt-2">
                  {timeTaken} minutes
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Question Review */}
        <div className="bg-white rounded-lg shadow-md p-8 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Question Review</h2>
          <div className="space-y-6">
            {questions.map((question: any, index: number) => {
              const detail = gradingDetails[question.id]
              const studentAnswer =
                detail?.student_answer ??
                (session.answers as any)?.[question.id] ??
                null
              const marksAwarded = detail?.marks_awarded ?? null
              const isCorrect = detail?.is_correct ?? null
              const needsGrading = detail?.needs_grading ?? false
              const aiFeedback = detail?.ai_feedback ?? null

              return (
                <div key={question.id} className="border border-gray-200 rounded-lg p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-gray-500 mb-2">
                        Question {index + 1} · {question.marks} marks
                      </p>
                      <p className="text-lg font-medium text-gray-900 mb-4">
                        {question.question_text}
                      </p>

                      {/* Student Answer */}
                      <div className="mb-4">
                        <p className="text-sm font-semibold text-gray-700 mb-2">
                          Your Answer:
                        </p>
                        {question.type === 'mcq' ? (
                          <div className="flex items-center">
                            <span
                              className={`text-base ${
                                isCorrect ? 'text-green-600' : 'text-red-600'
                              }`}
                            >
                              {isCorrect ? '✓' : '✗'}
                            </span>
                            <span className="ml-2 text-gray-900">
                              {studentAnswer ?? '(Not answered)'}
                            </span>
                          </div>
                        ) : (
                          <p className="text-gray-900 bg-gray-50 p-3 rounded">
                            {studentAnswer ?? '(Not answered)'}
                          </p>
                        )}
                      </div>

                      {/* Correct Answer */}
                      <div className="mb-4">
                        <p className="text-sm font-semibold text-gray-700 mb-2">
                          Correct Answer:
                        </p>
                        <p className="text-green-700 font-medium">
                          {question.correct_answer}
                        </p>
                      </div>

                      {/* AI Feedback */}
                      {aiFeedback && (
                        <div className="mb-4 bg-blue-50 border border-blue-200 rounded p-3">
                          <p className="text-sm font-semibold text-blue-700 mb-1">
                            AI Feedback:
                          </p>
                          <p className="text-sm text-blue-800">{aiFeedback}</p>
                        </div>
                      )}

                      {/* Pending grading notice */}
                      {needsGrading === true && marksAwarded === null && (
                        <div className="mb-4 bg-yellow-50 border border-yellow-200 rounded p-3">
                          <p className="text-sm text-yellow-700">
                            ⏳ This answer is pending AI review.
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Marks */}
                    <div className="ml-4 text-center min-w-[60px]">
                      <p className="text-sm text-gray-600">Marks</p>
                      {needsGrading === true && marksAwarded === null ? (
                        <p className="text-2xl font-bold text-yellow-500">—</p>
                      ) : (
                        <p
                          className={`text-2xl font-bold ${
                            isCorrect ? 'text-green-600' : 'text-red-600'
                          }`}
                        >
                          {marksAwarded ?? 0}/{question.marks}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Behavior & Integrity */}
        <div className="bg-white rounded-lg shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            Behavior & Integrity
          </h2>
          <div className="grid grid-cols-2 gap-8 mb-8">
            <div>
              <p className="text-gray-600">Total Flags</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {flags?.length ?? 0}
              </p>
            </div>
            <div>
              <p className="text-gray-600">Cheating Risk Score</p>
              <p
                className={`text-3xl font-bold mt-2 ${
                  displayCheatingScore > 70
                    ? 'text-red-600'
                    : displayCheatingScore > 40
                    ? 'text-yellow-600'
                    : 'text-green-600'
                }`}
              >
                {displayCheatingScore.toFixed(0)}%
              </p>
            </div>
          </div>

          {Object.keys(flagTypeCounts).length > 0 ? (
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-4">
                Flag Types Detected
              </p>
              <div className="space-y-2">
                {Object.entries(flagTypeCounts).map(([type, count]) => (
                  <div
                    key={type}
                    className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded"
                  >
                    <span className="text-gray-700 capitalize">
                      {type.replace(/_/g, ' ')}
                    </span>
                    <span className="font-semibold text-gray-900">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-500">No flags detected. Great exam!</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export default async function ResultsPage({
  params
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  // Fetch session
  const { data: sessionData } = await supabase.rpc('get_student_sessions', {
    student_id_param: user.id
  })
  let session = (sessionData ?? []).find((s: any) => s.id === id) ?? null

  if (!session) redirect('/student/home')

  // Auto-grade if needed — also re-grades short/long answers missing AI feedback
  const hasUngradedQuestions =
    !session.grading_details ||
    Object.keys(session.grading_details).length === 0 ||
    Object.values(session.grading_details).some(
      (d: any) =>
        d.needs_grading === true ||
        d.marks_awarded === null ||
        (
          (d.type === 'short_answer' || d.type === 'long_answer') &&
          d.student_answer &&
          d.student_answer.trim() !== '' &&
          (
            !d.ai_feedback ||
            d.ai_feedback === 'Answer not matching (fallback)' ||
            d.ai_feedback === 'Answer not matching' ||
            d.ai_feedback === 'Graded by AI'
          )
        )
    )

  if (hasUngradedQuestions) {
    try {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

      // ✅ Next.js 16: cookies() returns a Promise — must be awaited
      const cookieStore = await cookies()
      const cookieHeader = cookieStore.toString()

      const gradeRes = await fetch(`${baseUrl}/api/grade-answers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: cookieHeader,
        },
        body: JSON.stringify({ session_id: id })
      })
      const gradeData = await gradeRes.json()
      console.log('grade-answers result:', gradeData)

      // Re-fetch session to get updated scores
      const { data: updatedSessionData } = await supabase.rpc(
        'get_student_sessions',
        { student_id_param: user.id }
      )
      const updatedSession = (updatedSessionData ?? []).find(
        (s: any) => s.id === id
      )
      if (updatedSession) session = updatedSession
    } catch (err) {
      console.error('Auto-grading failed:', err)
    }
  }

  // Fetch exam
  const { data: examData } = await supabase.rpc('get_exam_by_id', {
    exam_id_param: session.exam_id
  })
  const exam = examData?.[0] ?? null

  // Fetch questions
  const { data: rawQuestions } = await supabase.rpc('get_exam_questions', {
    exam_id_param: session.exam_id
  })
  const questions = (rawQuestions ?? []).map((q: any) => {
    let options = null
    if (q.options) {
      let parsed = q.options
      if (typeof q.options === 'string') {
        try { parsed = JSON.parse(q.options) } catch { parsed = [] }
      }
      options = Array.isArray(parsed)
        ? parsed.map((o: any) => typeof o === 'object' ? o.value : o)
        : null
    }
    return { ...q, options }
  })

  // Fetch flags via RPC
  const { data: flags } = await supabase.rpc('get_exam_flags', {
    session_id_param: id
  })

  // Score
  const scorePercentage = session.max_score > 0
    ? ((session.score / session.max_score) * 100).toFixed(1)
    : '0'

  const isPassed = exam?.pass_marks
    ? session.score >= exam.pass_marks
    : parseFloat(scorePercentage) >= 50

  const timeTaken = session.started_at && session.submitted_at
    ? Math.round(
        (new Date(session.submitted_at).getTime() -
          new Date(session.started_at).getTime()) / 60000
      )
    : 0

  // Flag type counts
  const flagTypeCounts: Record<string, number> = {}
  for (const flag of (flags ?? []) as any[]) {
    const key = flag.flag_type ?? flag.event_type
    flagTypeCounts[key] = (flagTypeCounts[key] ?? 0) + 1
  }

  const gradingDetails = session.grading_details ?? {}

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
            <a
              href="/student/home"
              className="text-blue-600 hover:text-blue-700 font-medium"
            >
              ← Back to Home
            </a>
          </div>
        </div>
      </div>

      {/* Main Content */}
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
                  <span className={`inline-block px-4 py-2 rounded-full font-semibold ${
                    isPassed
                      ? 'bg-green-100 text-green-800'
                      : 'bg-red-100 text-red-800'
                  }`}>
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
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            Question Review
          </h2>
          <div className="space-y-6">
            {questions.map((question: any, index: number) => {
              const detail = gradingDetails[question.id]
              const studentAnswer = detail?.student_answer
                ?? session.answers?.[question.id]
                ?? null
              const marksAwarded = detail?.marks_awarded ?? null
              const isCorrect = detail?.is_correct ?? null
              const needsGrading = detail?.needs_grading ?? false
              const aiFeedback = (detail as any)?.ai_feedback ?? null

              return (
                <div
                  key={question.id}
                  className="border border-gray-200 rounded-lg p-6"
                >
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
                            <span className={`text-base ${
                              isCorrect ? 'text-green-600' : 'text-red-600'
                            }`}>
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
                            ⏳ This answer is pending manual review.
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
                        <p className={`text-2xl font-bold ${
                          isCorrect ? 'text-green-600' : 'text-red-600'
                        }`}>
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
              <p className={`text-3xl font-bold mt-2 ${
                (session.cheating_score ?? 0) > 0.7
                  ? 'text-red-600'
                  : (session.cheating_score ?? 0) > 0.4
                  ? 'text-yellow-600'
                  : 'text-green-600'
              }`}>
                {((session.cheating_score ?? 0) * 100).toFixed(0)}%
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